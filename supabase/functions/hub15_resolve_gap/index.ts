/**
 * Hub 1.5 Resolve Gap
 * process_id: hub15_resolve_gap
 * version: 1.0.0
 * 
 * // DOCTRINE LOCKED — PASS 1.5 COMPLETE
 * DO NOT MODIFY — downstream depends on this shape
 *
 * PURPOSE: Convert successful remediation into vault-ready addendum.
 * This is the ONLY path from remediation to permanent storage.
 * 
 * HARD RULES:
 * - Validate resolved payload (schema + confidence floor)
 * - Ensure gap is in terminal state (resolved via attempt)
 * - Create addendum payload (in-memory transformation)
 * - Push to vault_push_queue (NO direct Neon write)
 * - Log resolution event
 * - Hub 1.5 NEVER waits on Neon
 * 
 * CONFIDENCE FLOOR: 0.5 (50%) minimum to accept resolution
 * 
 * This is the handoff valve. Don't let it leak.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS - DO NOT MODIFY
// ============================================================================
const PROCESS_ID = "hub15_resolve_gap";
const VERSION = "1.0.0";

// Confidence floor - minimum acceptable confidence to resolve
const CONFIDENCE_FLOOR = 0.5; // 50%

// Valid sources
const VALID_SOURCES = ["scraper", "ai_caller", "manual"] as const;
type Source = typeof VALID_SOURCES[number];

// Valid confidence levels (string format from workers)
const VALID_CONFIDENCE_LEVELS = ["low", "medium"] as const;
type ConfidenceLevel = typeof VALID_CONFIDENCE_LEVELS[number];

// Confidence level to numeric mapping
const CONFIDENCE_MAP: Record<ConfidenceLevel, number> = {
  low: 0.3,
  medium: 0.6
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================
interface ResolvedRate {
  unit_size: string;
  monthly_rate: number | null;
  climate_control_rate?: number | null;
  confidence: ConfidenceLevel;
}

interface ResolveInput {
  gap_queue_id: string;
  run_id: string;
  resolved_data: {
    rates: ResolvedRate[];
    promo_info?: string | null;
    admin_fee?: number | null;
    confidence: ConfidenceLevel | number; // Accept both string and numeric
    source: Source;
  };
  transcript_hash?: string;
  call_duration_seconds?: number;
  cost_cents?: number;
}

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================
interface ResolveOutput {
  process_id: string;
  version: string;
  gap_queue_id: string;
  status: "resolved" | "rejected" | "error";
  addendum_id?: string;
  queued_for_vault: boolean;
  rejection_reason?: string;
  validation_errors?: string[];
  duration_ms: number;
  error?: string;
}

// ============================================================================
// ADDENDUM PAYLOAD (Vault-ready format)
// ============================================================================
interface VaultAddendum {
  // Provenance
  source_hub: "hub15";
  source_gap_queue_id: string;
  source_run_id: string;
  pass1_run_id: string;
  
  // Competitor identification
  competitor_id: string;
  competitor_name: string;
  competitor_address: string | null;
  
  // Resolved data
  rates: {
    unit_size: string;
    monthly_rate: number | null;
    climate_control_rate: number | null;
  }[];
  promo_info: string | null;
  admin_fee: number | null;
  
  // Quality metadata
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  source: Source;
  transcript_hash: string | null;
  
  // Audit
  resolved_at: string;
  attempt_count: number;
  total_cost_cents: number;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  confidence_score: number;
}

function validateResolvedData(data: ResolveInput["resolved_data"]): ValidationResult {
  const errors: string[] = [];
  
  // Check rates array
  if (!data.rates || !Array.isArray(data.rates)) {
    errors.push("rates array is required");
  } else if (data.rates.length === 0) {
    errors.push("rates array cannot be empty");
  } else {
    // Validate each rate
    const ratesWithValues = data.rates.filter(r => r.monthly_rate !== null && r.monthly_rate > 0);
    if (ratesWithValues.length === 0) {
      errors.push("at least one rate must have a valid monthly_rate > 0");
    }
    
    for (let i = 0; i < data.rates.length; i++) {
      const rate = data.rates[i];
      if (!rate.unit_size || typeof rate.unit_size !== "string") {
        errors.push(`rates[${i}].unit_size is required`);
      }
      if (rate.monthly_rate !== null && (typeof rate.monthly_rate !== "number" || rate.monthly_rate < 0)) {
        errors.push(`rates[${i}].monthly_rate must be a positive number or null`);
      }
      if (rate.confidence && !VALID_CONFIDENCE_LEVELS.includes(rate.confidence)) {
        errors.push(`rates[${i}].confidence must be one of: ${VALID_CONFIDENCE_LEVELS.join(", ")}`);
      }
    }
  }
  
  // Check source
  if (!data.source || !VALID_SOURCES.includes(data.source)) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(", ")}`);
  }
  
  // Calculate confidence score
  let confidenceScore: number;
  if (typeof data.confidence === "number") {
    confidenceScore = data.confidence;
  } else if (typeof data.confidence === "string" && VALID_CONFIDENCE_LEVELS.includes(data.confidence as ConfidenceLevel)) {
    confidenceScore = CONFIDENCE_MAP[data.confidence as ConfidenceLevel];
  } else {
    errors.push(`confidence must be a number or one of: ${VALID_CONFIDENCE_LEVELS.join(", ")}`);
    confidenceScore = 0;
  }
  
  // Check confidence floor
  if (confidenceScore < CONFIDENCE_FLOOR) {
    errors.push(`confidence score ${confidenceScore} is below floor ${CONFIDENCE_FLOOR}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    confidence_score: confidenceScore
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const input: ResolveInput = await req.json();
    
    console.log(`[${PROCESS_ID}@${VERSION}] Resolving gap_queue_id=${input.gap_queue_id}`);

    // ========================================================================
    // VALIDATION - Fail fast on bad input
    // ========================================================================
    if (!input.gap_queue_id) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          gap_queue_id: "",
          status: "error",
          queued_for_vault: false,
          duration_ms: Date.now() - startTime,
          error: "INVALID_INPUT: gap_queue_id is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!input.run_id) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          gap_queue_id: input.gap_queue_id,
          status: "error",
          queued_for_vault: false,
          duration_ms: Date.now() - startTime,
          error: "INVALID_INPUT: run_id is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!input.resolved_data) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          gap_queue_id: input.gap_queue_id,
          status: "error",
          queued_for_vault: false,
          duration_ms: Date.now() - startTime,
          error: "INVALID_INPUT: resolved_data is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate resolved data schema + confidence floor
    const validation = validateResolvedData(input.resolved_data);
    if (!validation.valid) {
      console.log(`[${PROCESS_ID}@${VERSION}] Validation failed: ${validation.errors.join(", ")}`);
      
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          gap_queue_id: input.gap_queue_id,
          status: "rejected",
          queued_for_vault: false,
          rejection_reason: "VALIDATION_FAILED",
          validation_errors: validation.errors,
          duration_ms: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================================================
    // STEP 1: Fetch gap queue entry and verify terminal state
    // ========================================================================
    const { data: gapQueue, error: gapFetchError } = await supabase
      .from("pass_1_5_gap_queue")
      .select("*")
      .eq("id", input.gap_queue_id)
      .single();

    if (gapFetchError) {
      throw new Error(`GAP_FETCH_FAILED: ${gapFetchError.message}`);
    }

    if (!gapQueue) {
      throw new Error(`GAP_NOT_FOUND: gap_queue_id=${input.gap_queue_id}`);
    }

    // Check if gap is already resolved
    if (gapQueue.status === "resolved") {
      console.log(`[${PROCESS_ID}@${VERSION}] Gap already resolved, idempotent return`);
      
      // Idempotent - return success without re-processing
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          gap_queue_id: input.gap_queue_id,
          status: "resolved",
          queued_for_vault: true, // Assume it was already queued
          duration_ms: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject if gap is in failed state (max attempts exceeded)
    if (gapQueue.status === "failed") {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          gap_queue_id: input.gap_queue_id,
          status: "rejected",
          queued_for_vault: false,
          rejection_reason: "GAP_PERMANENTLY_FAILED",
          duration_ms: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2: Build vault addendum (in-memory transformation)
    // ========================================================================
    const confidenceLevel: ConfidenceLevel = typeof input.resolved_data.confidence === "string"
      ? input.resolved_data.confidence as ConfidenceLevel
      : validation.confidence_score >= 0.5 ? "medium" : "low";

    const addendum: VaultAddendum = {
      // Provenance
      source_hub: "hub15",
      source_gap_queue_id: input.gap_queue_id,
      source_run_id: input.run_id,
      pass1_run_id: gapQueue.pass1_run_id,
      
      // Competitor identification
      competitor_id: gapQueue.competitor_id,
      competitor_name: gapQueue.competitor_name,
      competitor_address: gapQueue.competitor_address,
      
      // Resolved data
      rates: input.resolved_data.rates.map(r => ({
        unit_size: r.unit_size,
        monthly_rate: r.monthly_rate,
        climate_control_rate: r.climate_control_rate ?? null
      })),
      promo_info: input.resolved_data.promo_info ?? null,
      admin_fee: input.resolved_data.admin_fee ?? null,
      
      // Quality metadata
      confidence_score: validation.confidence_score,
      confidence_level: confidenceLevel,
      source: input.resolved_data.source,
      transcript_hash: input.transcript_hash ?? null,
      
      // Audit
      resolved_at: new Date().toISOString(),
      attempt_count: gapQueue.attempt_count || 1,
      total_cost_cents: input.cost_cents ?? 0
    };

    console.log(`[${PROCESS_ID}@${VERSION}] Addendum built: competitor=${addendum.competitor_name}, rates=${addendum.rates.length}`);

    // ========================================================================
    // STEP 3: Update gap queue status to resolved
    // ========================================================================
    const { error: updateError } = await supabase
      .from("pass_1_5_gap_queue")
      .update({
        status: "resolved",
        updated_at: new Date().toISOString()
      })
      .eq("id", input.gap_queue_id);

    if (updateError) {
      throw new Error(`GAP_UPDATE_FAILED: ${updateError.message}`);
    }

    // ========================================================================
    // STEP 4: Queue for vault push (NO direct Neon write)
    // ========================================================================
    const { data: vaultQueueEntry, error: vaultQueueError } = await supabase
      .from("vault_push_queue")
      .insert({
        staging_id: null, // Hub 1.5 doesn't use staging_payload
        status: "pending",
        neon_payload: {
          type: "hub15_rate_addendum",
          version: VERSION,
          addendum: addendum
        }
      })
      .select("id")
      .single();

    if (vaultQueueError) {
      // Rollback gap status on queue failure
      await supabase
        .from("pass_1_5_gap_queue")
        .update({
          status: gapQueue.status,
          updated_at: new Date().toISOString()
        })
        .eq("id", input.gap_queue_id);

      throw new Error(`VAULT_QUEUE_FAILED: ${vaultQueueError.message}`);
    }

    const addendumId = vaultQueueEntry?.id;
    console.log(`[${PROCESS_ID}@${VERSION}] Queued for vault: ${addendumId}`);

    // ========================================================================
    // STEP 5: Log resolution event
    // ========================================================================
    const { error: logError } = await supabase
      .from("engine_logs")
      .insert({
        engine: PROCESS_ID,
        event: "gap_resolved",
        status: "success",
        payload: {
          version: VERSION,
          gap_queue_id: input.gap_queue_id,
          run_id: input.run_id,
          pass1_run_id: gapQueue.pass1_run_id,
          competitor_id: gapQueue.competitor_id,
          competitor_name: gapQueue.competitor_name,
          vault_queue_id: addendumId,
          confidence_score: validation.confidence_score,
          source: input.resolved_data.source,
          rates_count: addendum.rates.filter(r => r.monthly_rate !== null).length
        }
      });

    if (logError) {
      console.warn(`[${PROCESS_ID}@${VERSION}] Log failed (non-fatal): ${logError.message}`);
    }

    // ========================================================================
    // SUCCESS RESPONSE
    // ========================================================================
    const duration = Date.now() - startTime;
    console.log(`[${PROCESS_ID}@${VERSION}] Resolved in ${duration}ms`);

    const response: ResolveOutput = {
      process_id: PROCESS_ID,
      version: VERSION,
      gap_queue_id: input.gap_queue_id,
      status: "resolved",
      addendum_id: addendumId,
      queued_for_vault: true,
      duration_ms: duration
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${PROCESS_ID}@${VERSION}] FATAL ERROR:`, errorMessage);
    
    return new Response(
      JSON.stringify({
        process_id: PROCESS_ID,
        version: VERSION,
        gap_queue_id: "",
        status: "error",
        queued_for_vault: false,
        duration_ms: Date.now() - startTime,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
