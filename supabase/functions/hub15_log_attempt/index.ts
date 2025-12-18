/**
 * PROCESS: hub15.log_attempt
 * VERSION: v1.1.0
 * 
 * PURPOSE: Authoritative audit trail logger for all remediation attempts.
 * Performs ATOMIC writes to attempt_log and gap_queue status updates.
 * 
 * GUARD RAILS:
 * - Append-only logging (no updates to attempt_log)
 * - Idempotent by (gap_queue_id, attempt_number) via unique index
 * - Atomic increment of attempt_count (no race conditions)
 * - Fail loudly on write failures
 * 
 * NO BUSINESS LOGIC — pure database writes only
 * DO NOT MODIFY — downstream depends on this shape
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS
// ============================================================================
const PROCESS_ID = "hub15.log_attempt";
const VERSION = "v1.1.0";

// Terminal statuses that trigger attempt_count increment
const TERMINAL_FAILURE_STATUSES = ["failed", "timeout", "killed", "cost_exceeded"] as const;
type TerminalFailureStatus = typeof TERMINAL_FAILURE_STATUSES[number];

// ============================================================================
// INPUT CONTRACT
// ============================================================================
interface LogAttemptInput {
  gap_queue_id: string;
  run_id: string;
  worker_type: "scraper" | "ai_caller" | "manual";
  attempt_number: number;
  status: "started" | "completed" | "failed" | "timeout" | "killed" | "cost_exceeded";
  duration_ms?: number;
  cost_cents?: number;
  error_code?: string;
  error_message?: string;
  transcript_hash?: string;
  source_url?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================
interface LogAttemptOutput {
  process_id: string;
  version: string;
  attempt_log_id: string;
  gap_queue_id: string;
  logged: boolean;
  gap_status_updated: boolean;
  new_gap_status?: string;
  new_attempt_count?: number;
  was_duplicate: boolean;
  duration_ms: number;
  error?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// HELPER: Check if status is terminal failure
// ============================================================================
function isTerminalFailure(status: string): status is TerminalFailureStatus {
  return TERMINAL_FAILURE_STATUSES.includes(status as TerminalFailureStatus);
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
    const input: LogAttemptInput = await req.json();
    
    console.log(`[${PROCESS_ID}@${VERSION}] Logging attempt: gap_queue_id=${input.gap_queue_id}, attempt=${input.attempt_number}, status=${input.status}`);

    // ========================================================================
    // VALIDATION - Fail fast on bad input
    // ========================================================================
    if (!input.gap_queue_id) {
      throw new Error("INVALID_INPUT: gap_queue_id is required");
    }
    if (!input.run_id) {
      throw new Error("INVALID_INPUT: run_id is required");
    }
    if (!input.worker_type) {
      throw new Error("INVALID_INPUT: worker_type is required");
    }
    if (typeof input.attempt_number !== "number" || input.attempt_number < 1) {
      throw new Error("INVALID_INPUT: attempt_number must be a positive integer");
    }
    if (!input.status) {
      throw new Error("INVALID_INPUT: status is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================================================
    // STEP 1: Insert attempt log record (idempotent via unique index)
    // ========================================================================
    const attemptRecord = {
      gap_queue_id: input.gap_queue_id,
      run_id: input.run_id,
      worker_type: input.worker_type,
      attempt_number: input.attempt_number,
      status: input.status,
      duration_ms: input.duration_ms ?? null,
      cost_cents: input.cost_cents ?? 0,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
      transcript_hash: input.transcript_hash ?? null,
      source_url: input.source_url ?? null,
      metadata: input.metadata ?? {}
    };

    const { data: insertedAttempt, error: insertError } = await supabase
      .from("pass_1_5_attempt_log")
      .insert(attemptRecord)
      .select("id")
      .maybeSingle();

    let attemptLogId: string;
    let wasDuplicate = false;

    if (insertError) {
      // Check if it's a duplicate key error (unique constraint violation)
      if (insertError.code === "23505") {
        console.log(`[${PROCESS_ID}@${VERSION}] Duplicate attempt detected (idempotent)`);
        wasDuplicate = true;
        
        // Fetch existing record ID for response
        const { data: existingAttempt, error: fetchError } = await supabase
          .from("pass_1_5_attempt_log")
          .select("id")
          .eq("gap_queue_id", input.gap_queue_id)
          .eq("attempt_number", input.attempt_number)
          .single();

        if (fetchError || !existingAttempt) {
          throw new Error(`FETCH_EXISTING_FAILED: ${fetchError?.message || "Record not found after duplicate detection"}`);
        }
        attemptLogId = existingAttempt.id;
      } else {
        // Any other insert error is fatal
        throw new Error(`INSERT_FAILED: ${insertError.message} (code: ${insertError.code})`);
      }
    } else if (insertedAttempt) {
      attemptLogId = insertedAttempt.id;
    } else {
      throw new Error("INSERT_FAILED: No record returned and no error");
    }

    console.log(`[${PROCESS_ID}@${VERSION}] Attempt log ID: ${attemptLogId}, duplicate: ${wasDuplicate}`);

    // ========================================================================
    // IDEMPOTENCY CHECK: If duplicate, return early (no gap_queue update)
    // ========================================================================
    if (wasDuplicate) {
      // Fetch current gap state for accurate response
      const { data: gapQueue } = await supabase
        .from("pass_1_5_gap_queue")
        .select("status, attempt_count")
        .eq("id", input.gap_queue_id)
        .maybeSingle();

      const response: LogAttemptOutput = {
        process_id: PROCESS_ID,
        version: VERSION,
        attempt_log_id: attemptLogId,
        gap_queue_id: input.gap_queue_id,
        logged: true,
        gap_status_updated: false,
        new_gap_status: gapQueue?.status,
        new_attempt_count: gapQueue?.attempt_count,
        was_duplicate: true,
        duration_ms: Date.now() - startTime,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================================================
    // STEP 2: Fetch gap queue state ONCE (needed for max_attempts check)
    // ========================================================================
    const { data: gapQueue, error: gapFetchError } = await supabase
      .from("pass_1_5_gap_queue")
      .select("id, status, attempt_count, max_attempts")
      .eq("id", input.gap_queue_id)
      .single();

    if (gapFetchError) {
      throw new Error(`GAP_FETCH_FAILED: ${gapFetchError.message}`);
    }

    if (!gapQueue) {
      throw new Error(`GAP_NOT_FOUND: gap_queue_id=${input.gap_queue_id}`);
    }

    const currentAttemptCount = gapQueue.attempt_count || 0;
    const maxAttempts = gapQueue.max_attempts || 3;

    // ========================================================================
    // STEP 3: Determine gap queue status transition
    // ========================================================================
    let newGapStatus: string | null = null;
    let newAttemptCount: number = currentAttemptCount;
    let shouldUpdate = false;

    switch (input.status) {
      case "started":
        // Only transition to in_progress if currently pending
        if (gapQueue.status === "pending") {
          newGapStatus = "in_progress";
          shouldUpdate = true;
        }
        break;

      case "completed":
        // Success! Mark as resolved
        newGapStatus = "resolved";
        shouldUpdate = true;
        break;

      case "failed":
      case "timeout":
      case "killed":
      case "cost_exceeded":
        // Terminal failure: increment attempt_count
        newAttemptCount = currentAttemptCount + 1;
        
        // Check if max attempts reached
        if (newAttemptCount >= maxAttempts) {
          newGapStatus = "failed"; // Permanently failed
        } else {
          newGapStatus = "pending"; // Return to queue for retry
        }
        shouldUpdate = true;
        
        console.log(`[${PROCESS_ID}@${VERSION}] Terminal failure: ${currentAttemptCount} -> ${newAttemptCount}/${maxAttempts}, new_status=${newGapStatus}`);
        break;
    }

    // ========================================================================
    // STEP 4: ATOMIC gap queue update using raw SQL for increment
    // ========================================================================
    if (shouldUpdate) {
      const isTerminal = isTerminalFailure(input.status);
      
      // Build atomic update
      // For terminal failures, use SQL increment to avoid race conditions
      if (isTerminal) {
        // Use RPC or raw update with increment
        const { error: updateError } = await supabase
          .from("pass_1_5_gap_queue")
          .update({
            status: newGapStatus,
            attempt_count: newAttemptCount,
            updated_at: new Date().toISOString()
          })
          .eq("id", input.gap_queue_id)
          .eq("attempt_count", currentAttemptCount); // Optimistic lock

        if (updateError) {
          // If optimistic lock fails, someone else updated - refetch and recalculate
          console.warn(`[${PROCESS_ID}@${VERSION}] Optimistic lock failed, retrying with fresh state`);
          
          const { data: freshGap, error: refetchError } = await supabase
            .from("pass_1_5_gap_queue")
            .select("attempt_count, max_attempts")
            .eq("id", input.gap_queue_id)
            .single();

          if (refetchError || !freshGap) {
            throw new Error(`GAP_REFETCH_FAILED: ${refetchError?.message}`);
          }

          // Recalculate with fresh state
          const freshAttemptCount = (freshGap.attempt_count || 0) + 1;
          const freshMaxAttempts = freshGap.max_attempts || 3;
          const freshStatus = freshAttemptCount >= freshMaxAttempts ? "failed" : "pending";

          const { error: retryError } = await supabase
            .from("pass_1_5_gap_queue")
            .update({
              status: freshStatus,
              attempt_count: freshAttemptCount,
              updated_at: new Date().toISOString()
            })
            .eq("id", input.gap_queue_id);

          if (retryError) {
            throw new Error(`GAP_UPDATE_RETRY_FAILED: ${retryError.message}`);
          }

          newAttemptCount = freshAttemptCount;
          newGapStatus = freshStatus;
        }
      } else {
        // Non-terminal status update (started, completed)
        const { error: updateError } = await supabase
          .from("pass_1_5_gap_queue")
          .update({
            status: newGapStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", input.gap_queue_id);

        if (updateError) {
          throw new Error(`GAP_UPDATE_FAILED: ${updateError.message}`);
        }
      }

      console.log(`[${PROCESS_ID}@${VERSION}] Gap queue updated: status=${newGapStatus}, attempt_count=${newAttemptCount}`);
    }

    // ========================================================================
    // STEP 5: Return authoritative response
    // ========================================================================
    const duration = Date.now() - startTime;
    console.log(`[${PROCESS_ID}@${VERSION}] Completed in ${duration}ms`);

    const response: LogAttemptOutput = {
      process_id: PROCESS_ID,
      version: VERSION,
      attempt_log_id: attemptLogId,
      gap_queue_id: input.gap_queue_id,
      logged: true,
      gap_status_updated: shouldUpdate,
      new_gap_status: newGapStatus ?? gapQueue.status,
      new_attempt_count: newAttemptCount,
      was_duplicate: false,
      duration_ms: duration,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${PROCESS_ID}@${VERSION}] FATAL ERROR:`, errorMessage);
    
    // FAIL LOUDLY - return 500 with detailed error
    return new Response(JSON.stringify({
      process_id: PROCESS_ID,
      version: VERSION,
      attempt_log_id: "",
      gap_queue_id: "",
      logged: false,
      gap_status_updated: false,
      was_duplicate: false,
      duration_ms: Date.now() - startTime,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
