/**
 * PROCESS: hub15.log_attempt
 * VERSION: v1.0.0
 * 
 * PURPOSE: Audit trail logger for all remediation attempts.
 * Performs atomic writes to attempt_log and gap_queue status updates.
 * 
 * GUARD RAILS:
 * - Append-only logging (no updates to attempt_log)
 * - Idempotent by (gap_queue_id, attempt_number)
 * - Fail loudly on write failures
 * 
 * NO BUSINESS LOGIC — pure database writes only
 * DO NOT MODIFY — downstream depends on this shape
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ================================================================
// CONSTANTS
// ================================================================
const PROCESS_ID = 'hub15.log_attempt';
const VERSION = 'v1.0.0';

// Terminal statuses that trigger attempt_count increment
const TERMINAL_FAILURE_STATUSES = ['failed', 'timeout', 'killed', 'cost_exceeded'] as const;

// ================================================================
// INPUT CONTRACT
// ================================================================
interface LogAttemptInput {
  gap_queue_id: string;
  run_id: string;
  worker_type: 'scraper' | 'ai_caller' | 'manual';
  attempt_number: number;
  status: 'started' | 'completed' | 'failed' | 'timeout' | 'killed' | 'cost_exceeded';
  duration_ms?: number;
  cost_cents?: number;
  error_code?: string;
  error_message?: string;
  transcript_hash?: string;
  source_url?: string;
  metadata?: Record<string, unknown>;
}

// ================================================================
// OUTPUT CONTRACT
// ================================================================
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
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const input: LogAttemptInput = await req.json();
    
    console.log(`[${PROCESS_ID}@${VERSION}] Logging attempt: gap_queue_id=${input.gap_queue_id}, attempt=${input.attempt_number}, status=${input.status}`);

    // Validate required fields
    if (!input.gap_queue_id || !input.run_id || !input.worker_type || 
        input.attempt_number === undefined || !input.status) {
      throw new Error('INVALID_INPUT: Missing required fields (gap_queue_id, run_id, worker_type, attempt_number, status)');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ================================================================
    // STEP 1: Insert attempt log record (idempotent via ON CONFLICT)
    // ================================================================
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

    // Try insert - will fail silently on duplicate due to unique constraint
    const { data: insertedAttempt, error: insertError } = await supabase
      .from('pass_1_5_attempt_log')
      .insert(attemptRecord)
      .select('id')
      .maybeSingle();

    let attemptLogId: string;
    let wasDuplicate = false;

    if (insertError) {
      // Check if it's a duplicate key error (unique constraint violation)
      if (insertError.code === '23505') {
        console.log(`[${PROCESS_ID}@${VERSION}] Duplicate attempt detected, fetching existing record`);
        wasDuplicate = true;
        
        // Fetch existing record
        const { data: existingAttempt, error: fetchError } = await supabase
          .from('pass_1_5_attempt_log')
          .select('id')
          .eq('gap_queue_id', input.gap_queue_id)
          .eq('attempt_number', input.attempt_number)
          .single();

        if (fetchError || !existingAttempt) {
          throw new Error(`FETCH_EXISTING_FAILED: ${fetchError?.message || 'No existing record found'}`);
        }
        attemptLogId = existingAttempt.id;
      } else {
        throw new Error(`INSERT_FAILED: ${insertError.message}`);
      }
    } else if (insertedAttempt) {
      attemptLogId = insertedAttempt.id;
    } else {
      throw new Error('INSERT_FAILED: No record returned and no error');
    }

    console.log(`[${PROCESS_ID}@${VERSION}] Attempt log ID: ${attemptLogId}, duplicate: ${wasDuplicate}`);

    // If duplicate, don't update gap_queue (idempotency)
    if (wasDuplicate) {
      const response: LogAttemptOutput = {
        process_id: PROCESS_ID,
        version: VERSION,
        attempt_log_id: attemptLogId,
        gap_queue_id: input.gap_queue_id,
        logged: true,
        gap_status_updated: false,
        was_duplicate: true,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ================================================================
    // STEP 2: Determine gap queue status transition
    // ================================================================
    let newGapStatus: string | null = null;
    let shouldIncrementAttempt = false;

    switch (input.status) {
      case 'started':
        newGapStatus = 'in_progress';
        break;
      case 'completed':
        newGapStatus = 'resolved';
        break;
      case 'failed':
      case 'timeout':
      case 'killed':
      case 'cost_exceeded':
        shouldIncrementAttempt = true;
        // newGapStatus determined after checking max_attempts
        break;
    }

    // ================================================================
    // STEP 3: Atomic gap queue update
    // ================================================================
    let newAttemptCount: number | undefined;

    if (newGapStatus || shouldIncrementAttempt) {
      // Fetch current gap queue state
      const { data: gapQueue, error: fetchError } = await supabase
        .from('pass_1_5_gap_queue')
        .select('attempt_count, max_attempts, status')
        .eq('id', input.gap_queue_id)
        .single();

      if (fetchError) {
        throw new Error(`GAP_FETCH_FAILED: ${fetchError.message}`);
      }

      if (!gapQueue) {
        throw new Error(`GAP_NOT_FOUND: gap_queue_id=${input.gap_queue_id}`);
      }

      // Calculate new values
      const currentAttemptCount = gapQueue.attempt_count || 0;
      const maxAttempts = gapQueue.max_attempts || 3;
      
      newAttemptCount = shouldIncrementAttempt 
        ? currentAttemptCount + 1 
        : currentAttemptCount;
      
      // If terminal failure and max_attempts reached → mark as failed
      // Otherwise reset to pending for retry
      if (shouldIncrementAttempt) {
        newGapStatus = newAttemptCount! >= maxAttempts ? 'failed' : 'pending';
        
        console.log(`[${PROCESS_ID}@${VERSION}] Terminal status: attempt_count ${currentAttemptCount} -> ${newAttemptCount}, max=${maxAttempts}, new_status=${newGapStatus}`);
      }

      // Update gap queue
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (newGapStatus) {
        updatePayload.status = newGapStatus;
      }

      if (shouldIncrementAttempt) {
        updatePayload.attempt_count = newAttemptCount;
      }

      const { error: updateError } = await supabase
        .from('pass_1_5_gap_queue')
        .update(updatePayload)
        .eq('id', input.gap_queue_id);

      if (updateError) {
        throw new Error(`GAP_UPDATE_FAILED: ${updateError.message}`);
      }

      console.log(`[${PROCESS_ID}@${VERSION}] Gap queue updated: status=${newGapStatus}, attempt_count=${newAttemptCount}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[${PROCESS_ID}@${VERSION}] Completed in ${duration}ms`);

    const response: LogAttemptOutput = {
      process_id: PROCESS_ID,
      version: VERSION,
      attempt_log_id: attemptLogId,
      gap_queue_id: input.gap_queue_id,
      logged: true,
      gap_status_updated: newGapStatus !== null || shouldIncrementAttempt,
      new_gap_status: newGapStatus ?? undefined,
      new_attempt_count: newAttemptCount,
      was_duplicate: false,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${PROCESS_ID}@${VERSION}] ERROR:`, errorMessage);
    
    return new Response(JSON.stringify({
      process_id: PROCESS_ID,
      version: VERSION,
      attempt_log_id: '',
      gap_queue_id: '',
      logged: false,
      gap_status_updated: false,
      was_duplicate: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
