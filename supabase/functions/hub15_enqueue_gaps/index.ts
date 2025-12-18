/**
 * Hub 1.5 Enqueue Gaps
 * process_id: hub15_enqueue_gaps
 * version: 1.0.0
 * 
 * // DOCTRINE LOCKED — PASS 1.5 COMPLETE
 * DO NOT MODIFY — downstream depends on this shape
 *
 * PURPOSE: Deterministically translate Pass 1 gap flags into remediation queue.
 * Reads GapFlag[] input and populates pass_1_5_gap_queue with deduplication.
 * 
 * HARD RULES:
 * - No worker dispatch (orchestrator handles that)
 * - No retries (log_attempt handles that)
 * - No scoring or ranking
 * - Dedup by (pass1_run_id, competitor_id, gap_type)
 * - Priority mapping is deterministic (documented below)
 * 
 * PRIORITY MAPPING:
 * - missing_rate     → "high"   (critical gap, no data at all)
 * - low_confidence   → "normal" (has data but quality is poor)
 * - no_phone         → "low"    (can't call, scraper-only)
 * - no_scrape_data   → "normal" (scraper failed, try AI caller)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS - DO NOT MODIFY
// ============================================================================
const PROCESS_ID = "hub15_enqueue_gaps";
const VERSION = "1.0.0";

// Priority mapping - deterministic, documented
const PRIORITY_MAP: Record<GapType, Priority> = {
  missing_rate: "high",
  low_confidence: "normal",
  no_phone: "low",
  no_scrape_data: "normal"
};

// Worker assignment - deterministic based on gap type and phone availability
const WORKER_ASSIGNMENT = {
  missing_rate: "ai_caller",      // Try calling first
  low_confidence: "ai_caller",    // Call to verify
  no_phone: "scraper",            // No phone, scraper only
  no_scrape_data: "ai_caller"     // Scraper failed, try calling
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
type GapType = "missing_rate" | "low_confidence" | "no_phone" | "no_scrape_data";
type Priority = "high" | "normal" | "low";

// ============================================================================
// INPUT CONTRACT
// ============================================================================
interface EnqueueInput {
  pass1_run_id: string;
  gap_flags: GapFlag[];
}

interface GapFlag {
  competitor_id: string;
  competitor_name: string;
  competitor_address?: string;
  gap_type: GapType;
  phone_number?: string;
  target_unit_sizes?: string[];
}

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================
interface EnqueueOutput {
  process_id: string;
  version: string;
  pass1_run_id: string;
  run_id: string;
  gaps_enqueued: number;
  gaps_skipped: number;
  gaps_total: number;
  queue_breakdown: {
    missing_rate: number;
    low_confidence: number;
    no_phone: number;
    no_scrape_data: number;
  };
  priority_breakdown: {
    high: number;
    normal: number;
    low: number;
  };
  duration_ms: number;
  error_code?: string;
  error_message?: string;
}

interface QueueEntry {
  id?: string;
  run_id: string;
  pass1_run_id: string;
  competitor_id: string;
  competitor_name: string;
  competitor_address: string | null;
  phone_number: string | null;
  gap_type: GapType;
  target_unit_sizes: string[];
  priority: Priority;
  status: string;
  assigned_worker: string | null;
  attempt_count: number;
  max_attempts: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate deduplication key for a gap entry
 */
function getDedupeKey(pass1RunId: string, competitorId: string, gapType: string): string {
  return `${pass1RunId}:${competitorId}:${gapType}`;
}

/**
 * Determine worker assignment based on gap type and phone availability
 */
function assignWorker(gapType: GapType, hasPhone: boolean): string | null {
  if (gapType === "no_phone" || !hasPhone) {
    return "scraper";
  }
  return WORKER_ASSIGNMENT[gapType];
}

/**
 * Validate gap flag structure
 */
function validateGapFlag(flag: GapFlag): { valid: boolean; error?: string } {
  if (!flag.competitor_id || typeof flag.competitor_id !== "string") {
    return { valid: false, error: "competitor_id is required" };
  }
  if (!flag.competitor_name || typeof flag.competitor_name !== "string") {
    return { valid: false, error: "competitor_name is required" };
  }
  if (!flag.gap_type || !["missing_rate", "low_confidence", "no_phone", "no_scrape_data"].includes(flag.gap_type)) {
    return { valid: false, error: "gap_type must be one of: missing_rate, low_confidence, no_phone, no_scrape_data" };
  }
  return { valid: true };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse input
    const input: EnqueueInput = await req.json();

    // Validate required fields
    if (!input.pass1_run_id) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          error_code: "INVALID_INPUT",
          error_message: "pass1_run_id is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!input.gap_flags || !Array.isArray(input.gap_flags)) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          error_code: "INVALID_INPUT",
          error_message: "gap_flags array is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate new run_id for this remediation batch
    const runId = crypto.randomUUID();

    console.log(`[${PROCESS_ID}] Processing ${input.gap_flags.length} gaps for pass1_run_id=${input.pass1_run_id}, run_id=${runId}`);

    // Fetch existing queue entries for deduplication
    const { data: existingEntries, error: fetchError } = await supabase
      .from("pass_1_5_gap_queue")
      .select("competitor_id, gap_type")
      .eq("pass1_run_id", input.pass1_run_id)
      .in("status", ["pending", "in_progress"]); // Only active entries

    if (fetchError) {
      console.error(`[${PROCESS_ID}] Failed to fetch existing entries:`, fetchError);
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          error_code: "DB_FETCH_ERROR",
          error_message: `Failed to fetch existing queue entries: ${fetchError.message}`
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build dedup set from existing entries
    const existingKeys = new Set<string>();
    if (existingEntries) {
      for (const entry of existingEntries) {
        existingKeys.add(getDedupeKey(input.pass1_run_id, entry.competitor_id, entry.gap_type));
      }
    }

    // Process gap flags
    const entriesToInsert: QueueEntry[] = [];
    const breakdown = { missing_rate: 0, low_confidence: 0, no_phone: 0, no_scrape_data: 0 };
    const priorityBreakdown = { high: 0, normal: 0, low: 0 };
    let skipped = 0;
    const validationErrors: string[] = [];

    for (const flag of input.gap_flags) {
      // Validate flag structure
      const validation = validateGapFlag(flag);
      if (!validation.valid) {
        validationErrors.push(`${flag.competitor_id || "unknown"}: ${validation.error}`);
        skipped++;
        continue;
      }

      // Check for duplicates
      const dedupeKey = getDedupeKey(input.pass1_run_id, flag.competitor_id, flag.gap_type);
      if (existingKeys.has(dedupeKey)) {
        console.log(`[${PROCESS_ID}] Skipping duplicate: ${dedupeKey}`);
        skipped++;
        continue;
      }

      // Prevent duplicates within this batch
      if (entriesToInsert.some(e => 
        e.competitor_id === flag.competitor_id && e.gap_type === flag.gap_type
      )) {
        skipped++;
        continue;
      }

      // Determine priority and worker
      const priority = PRIORITY_MAP[flag.gap_type];
      const hasPhone = Boolean(flag.phone_number && flag.phone_number.length >= 10);
      const assignedWorker = assignWorker(flag.gap_type, hasPhone);

      // Build queue entry
      const entry: QueueEntry = {
        run_id: runId,
        pass1_run_id: input.pass1_run_id,
        competitor_id: flag.competitor_id,
        competitor_name: flag.competitor_name,
        competitor_address: flag.competitor_address || null,
        phone_number: flag.phone_number || null,
        gap_type: flag.gap_type,
        target_unit_sizes: flag.target_unit_sizes || ["10x10", "10x20"],
        priority,
        status: "pending",
        assigned_worker: assignedWorker,
        attempt_count: 0,
        max_attempts: 3
      };

      entriesToInsert.push(entry);
      breakdown[flag.gap_type]++;
      priorityBreakdown[priority]++;
    }

    // Insert entries in batch
    let enqueued = 0;
    if (entriesToInsert.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from("pass_1_5_gap_queue")
        .insert(entriesToInsert)
        .select("id");

      if (insertError) {
        console.error(`[${PROCESS_ID}] Failed to insert queue entries:`, insertError);
        return new Response(
          JSON.stringify({
            process_id: PROCESS_ID,
            version: VERSION,
            error_code: "DB_INSERT_ERROR",
            error_message: `Failed to insert queue entries: ${insertError.message}`
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      enqueued = insertedData?.length || entriesToInsert.length;
      console.log(`[${PROCESS_ID}] Inserted ${enqueued} queue entries`);
    }

    // Log enqueue event to engine_logs
    const { error: logError } = await supabase
      .from("engine_logs")
      .insert({
        engine: PROCESS_ID,
        event: "gaps_enqueued",
        status: "success",
        payload: {
          version: VERSION,
          pass1_run_id: input.pass1_run_id,
          run_id: runId,
          gaps_enqueued: enqueued,
          gaps_skipped: skipped,
          gaps_total: input.gap_flags.length,
          breakdown,
          priority_breakdown: priorityBreakdown,
          validation_errors: validationErrors.length > 0 ? validationErrors : undefined
        }
      });

    if (logError) {
      console.warn(`[${PROCESS_ID}] Failed to log event (non-fatal):`, logError);
    }

    // Build response
    const output: EnqueueOutput = {
      process_id: PROCESS_ID,
      version: VERSION,
      pass1_run_id: input.pass1_run_id,
      run_id: runId,
      gaps_enqueued: enqueued,
      gaps_skipped: skipped,
      gaps_total: input.gap_flags.length,
      queue_breakdown: breakdown,
      priority_breakdown: priorityBreakdown,
      duration_ms: Date.now() - startTime
    };

    console.log(`[${PROCESS_ID}] Complete: enqueued=${enqueued}, skipped=${skipped}, duration=${output.duration_ms}ms`);

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[${PROCESS_ID}] Unexpected error:`, error);
    
    return new Response(
      JSON.stringify({
        process_id: PROCESS_ID,
        version: VERSION,
        error_code: "INTERNAL_ERROR",
        error_message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
