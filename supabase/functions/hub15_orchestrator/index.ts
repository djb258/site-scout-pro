/**
 * PROCESS: hub15.orchestrator
 * VERSION: v1.0.0
 * 
 * PURPOSE: Controller for Hub 1.5 remediation workflow.
 * Coordinates gap queue processing with 4-tier cost ladder escalation.
 * 
 * GUARD RAILS:
 * - $50/day cost cap
 * - 500 calls/day limit
 * - 70% failure rate triggers kill switch
 * - 3 retry cap per gap
 * - 20 concurrent workers max
 * 
 * COST LADDER:
 * Tier 1: OSM Discovery (free) → Tier 2: AI Search ($0.01) → Tier 3: Scrape (free) → Tier 4: AI Call ($0.15)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ================================================================
// CONSTANTS
// ================================================================
const PROCESS_ID = 'hub15.orchestrator';
const VERSION = 'v1.0.0';

// Guard Rails - DO NOT MODIFY WITHOUT ADR
const GUARD_RAILS = {
  RETRY_CAP: 3,
  COST_CAP_CENTS: 5000,        // $50/day
  CONCURRENT_WORKERS: 20,
  CALL_TIMEOUT_MS: 180000,     // 3 min
  DAILY_CALL_LIMIT: 500,
  FAILURE_RATE_THRESHOLD: 0.70,
  BATCH_SIZE: 10,              // Process 10 gaps at a time
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ================================================================
// INPUT/OUTPUT CONTRACTS
// ================================================================
interface OrchestratorInput {
  run_id: string;
  pass1_run_id: string;
  action: 'start' | 'status' | 'kill' | 'process_batch';
}

interface QueueSummary {
  pending: number;
  in_progress: number;
  resolved: number;
  failed: number;
  killed: number;
}

interface OrchestratorOutput {
  process_id: string;
  version: string;
  run_id: string;
  status: 'started' | 'running' | 'completed' | 'killed' | 'error';
  action: string;
  queue_summary: QueueSummary;
  guard_rails: typeof GUARD_RAILS;
  cost_cents_today: number;
  calls_today: number;
  failure_rate: number;
  kill_switch_active: boolean;
  processed_count?: number;
  error?: string;
}

interface GapQueueItem {
  id: string;
  run_id: string;
  pass1_run_id: string;
  competitor_id: string;
  competitor_name: string;
  competitor_address?: string;
  phone_number?: string;
  gap_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  priority: string;
  assigned_worker?: string;
  target_unit_sizes?: string[];
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

async function getQueueSummary(supabase: any, runId?: string): Promise<QueueSummary> {
  let query = supabase.from('pass_1_5_gap_queue').select('status');
  if (runId) {
    query = query.eq('run_id', runId);
  }

  const { data: gaps } = await query;

  const summary: QueueSummary = {
    pending: 0,
    in_progress: 0,
    resolved: 0,
    failed: 0,
    killed: 0,
  };

  (gaps || []).forEach((gap: { status: string }) => {
    const status = gap.status as keyof QueueSummary;
    if (status in summary) {
      summary[status]++;
    }
  });

  return summary;
}

async function getTodayMetrics(supabase: any): Promise<{ costCents: number; callCount: number; failureRate: number }> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  // Get today's cost
  const { data: costData } = await supabase
    .from('ai_cost_tracker')
    .select('cost_cents')
    .gte('created_at', todayStartIso);

  const costCents = (costData || []).reduce((sum: number, row: { cost_cents: number }) => sum + (row.cost_cents || 0), 0);

  // Get today's call count and failure rate
  const { data: attempts } = await supabase
    .from('pass_1_5_attempt_log')
    .select('status, worker_type')
    .gte('created_at', todayStartIso);

  const callCount = (attempts || []).filter((a: { worker_type: string }) => a.worker_type === 'ai_caller').length;
  
  const terminalAttempts = (attempts || []).filter((a: { status: string }) => 
    !['started', 'in_progress'].includes(a.status)
  );
  const failedCount = terminalAttempts.filter((a: { status: string }) => 
    ['failed', 'timeout', 'killed', 'cost_exceeded'].includes(a.status)
  ).length;
  
  const failureRate = terminalAttempts.length > 0 ? failedCount / terminalAttempts.length : 0;

  return { costCents, callCount, failureRate };
}

async function checkKillSwitch(supabase: any): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: killedGaps } = await supabase
    .from('pass_1_5_gap_queue')
    .select('id')
    .eq('status', 'killed')
    .gte('updated_at', oneHourAgo)
    .limit(1);

  return (killedGaps?.length || 0) > 0;
}

async function activateKillSwitch(supabase: any, runId: string, reason: string): Promise<void> {
  console.log(`[${PROCESS_ID}] Activating kill switch: ${reason}`);
  
  // Mark all pending/in_progress gaps as killed
  await supabase
    .from('pass_1_5_gap_queue')
    .update({ status: 'killed', updated_at: new Date().toISOString() })
    .eq('run_id', runId)
    .in('status', ['pending', 'in_progress']);

  // Log event
  await supabase.from('hub0_event_log').insert({
    process_id: PROCESS_ID,
    action: 'kill_switch_activated',
    status: 'killed',
    metadata: { run_id: runId, reason },
  });
}

function selectWorkerForGap(gap: GapQueueItem, hasWebsite: boolean): 'ai_search' | 'scraper' | 'ai_caller' {
  // Tier escalation logic based on gap type and attempt count
  
  if (gap.attempt_count === 0) {
    // First attempt: try AI search
    return 'ai_search';
  }
  
  if (gap.attempt_count === 1 && hasWebsite) {
    // Second attempt: try scraping if we have a URL
    return 'scraper';
  }
  
  if (gap.phone_number && gap.attempt_count < GUARD_RAILS.RETRY_CAP) {
    // Escalate to AI caller if we have phone
    return 'ai_caller';
  }
  
  // Default to scraper
  return 'scraper';
}

async function dispatchWorker(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  gap: GapQueueItem,
  workerType: string
): Promise<{ success: boolean; error?: string }> {
  const endpoint = workerType === 'ai_caller' 
    ? 'hub15_ai_caller'
    : workerType === 'ai_search'
    ? 'hub15_competitor_search'
    : 'hub15_rate_scraper';

  try {
    // Update gap status to in_progress
    await supabase
      .from('pass_1_5_gap_queue')
      .update({ 
        status: 'in_progress', 
        assigned_worker: workerType,
        attempt_count: gap.attempt_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gap.id);

    // Dispatch to worker (non-blocking)
    const payload = workerType === 'ai_caller' 
      ? {
          gap_queue_id: gap.id,
          run_id: gap.run_id,
          competitor_name: gap.competitor_name,
          phone_number: gap.phone_number,
          target_unit_sizes: gap.target_unit_sizes || ['10x10', '10x20'],
          attempt_number: gap.attempt_count + 1,
        }
      : workerType === 'ai_search'
      ? {
          run_id: gap.run_id,
          competitor_id: gap.competitor_id,
          competitor_name: gap.competitor_name,
          county: '', // Will be looked up by worker
          state: '',
          address: gap.competitor_address,
        }
      : {
          gap_queue_id: gap.id,
          run_id: gap.run_id,
          competitor_id: gap.competitor_id,
          competitor_name: gap.competitor_name,
          competitor_address: gap.competitor_address,
          target_unit_sizes: gap.target_unit_sizes || ['10x10', '10x20'],
          attempt_number: gap.attempt_count + 1,
        };

    // Fire and forget - worker will update gap status on completion
    fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(err => {
      console.error(`[${PROCESS_ID}] Worker dispatch failed:`, err);
    });

    return { success: true };
  } catch (error) {
    console.error(`[${PROCESS_ID}] Failed to dispatch ${workerType}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ================================================================
// MAIN HANDLER
// ================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const input: OrchestratorInput = await req.json();
    const { run_id, pass1_run_id, action } = input;

    if (!run_id || !action) {
      return new Response(JSON.stringify({
        process_id: PROCESS_ID,
        version: VERSION,
        status: 'error',
        error: 'Missing required fields: run_id, action',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${PROCESS_ID}@${VERSION}] Action=${action} for run_id=${run_id}`);

    // Init Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current metrics
    const queueSummary = await getQueueSummary(supabase, run_id);
    const { costCents, callCount, failureRate } = await getTodayMetrics(supabase);
    let killSwitchActive = await checkKillSwitch(supabase);

    // ================================================================
    // ACTION: KILL
    // ================================================================
    if (action === 'kill') {
      await activateKillSwitch(supabase, run_id, 'Manual kill switch activation');
      killSwitchActive = true;
    }

    // ================================================================
    // ACTION: STATUS (read-only)
    // ================================================================
    if (action === 'status') {
      const response: OrchestratorOutput = {
        process_id: PROCESS_ID,
        version: VERSION,
        run_id,
        status: killSwitchActive ? 'killed' : (queueSummary.in_progress > 0 ? 'running' : 'completed'),
        action,
        queue_summary: queueSummary,
        guard_rails: GUARD_RAILS,
        cost_cents_today: costCents,
        calls_today: callCount,
        failure_rate: failureRate,
        kill_switch_active: killSwitchActive,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ================================================================
    // GUARD RAIL CHECKS (for start/process_batch)
    // ================================================================
    if (action === 'start' || action === 'process_batch') {
      // Check cost cap
      if (costCents >= GUARD_RAILS.COST_CAP_CENTS) {
        await activateKillSwitch(supabase, run_id, `Cost cap exceeded: ${costCents} cents`);
        killSwitchActive = true;
      }

      // Check call limit
      if (callCount >= GUARD_RAILS.DAILY_CALL_LIMIT) {
        await activateKillSwitch(supabase, run_id, `Daily call limit exceeded: ${callCount} calls`);
        killSwitchActive = true;
      }

      // Check failure rate
      if (failureRate >= GUARD_RAILS.FAILURE_RATE_THRESHOLD) {
        await activateKillSwitch(supabase, run_id, `Failure rate threshold exceeded: ${(failureRate * 100).toFixed(1)}%`);
        killSwitchActive = true;
      }

      if (killSwitchActive) {
        const response: OrchestratorOutput = {
          process_id: PROCESS_ID,
          version: VERSION,
          run_id,
          status: 'killed',
          action,
          queue_summary: await getQueueSummary(supabase, run_id),
          guard_rails: GUARD_RAILS,
          cost_cents_today: costCents,
          calls_today: callCount,
          failure_rate: failureRate,
          kill_switch_active: true,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ================================================================
    // ACTION: START
    // ================================================================
    if (action === 'start') {
      // Log start event
      await supabase.from('hub0_event_log').insert({
        process_id: PROCESS_ID,
        action: 'orchestrator_started',
        status: 'started',
        metadata: { run_id, pass1_run_id },
      });

      // Check for existing pending gaps or create from Pass 1 results
      const { data: existingGaps } = await supabase
        .from('pass_1_5_gap_queue')
        .select('id')
        .eq('run_id', run_id)
        .limit(1);

      if (!existingGaps || existingGaps.length === 0) {
        // No gaps yet - this run needs gap creation from hub15_enqueue_gaps
        console.log(`[${PROCESS_ID}] No gaps found for run_id=${run_id}, needs enqueue_gaps first`);
      }

      const response: OrchestratorOutput = {
        process_id: PROCESS_ID,
        version: VERSION,
        run_id,
        status: 'started',
        action,
        queue_summary: await getQueueSummary(supabase, run_id),
        guard_rails: GUARD_RAILS,
        cost_cents_today: costCents,
        calls_today: callCount,
        failure_rate: failureRate,
        kill_switch_active: false,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ================================================================
    // ACTION: PROCESS_BATCH
    // ================================================================
    if (action === 'process_batch') {
      // Get pending gaps (prioritized)
      const { data: pendingGaps } = await supabase
        .from('pass_1_5_gap_queue')
        .select('*')
        .eq('run_id', run_id)
        .eq('status', 'pending')
        .order('priority', { ascending: true }) // critical > high > normal > low
        .limit(GUARD_RAILS.BATCH_SIZE);

      if (!pendingGaps || pendingGaps.length === 0) {
        console.log(`[${PROCESS_ID}] No pending gaps to process`);
        
        const response: OrchestratorOutput = {
          process_id: PROCESS_ID,
          version: VERSION,
          run_id,
          status: 'completed',
          action,
          queue_summary: await getQueueSummary(supabase, run_id),
          guard_rails: GUARD_RAILS,
          cost_cents_today: costCents,
          calls_today: callCount,
          failure_rate: failureRate,
          kill_switch_active: false,
          processed_count: 0,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let processedCount = 0;

      // Process each gap
      for (const gap of pendingGaps as GapQueueItem[]) {
        // Check if we've hit concurrent worker limit
        const { count: inProgressCount } = await supabase
          .from('pass_1_5_gap_queue')
          .select('id', { count: 'exact', head: true })
          .eq('run_id', run_id)
          .eq('status', 'in_progress');

        if ((inProgressCount || 0) >= GUARD_RAILS.CONCURRENT_WORKERS) {
          console.log(`[${PROCESS_ID}] Concurrent worker limit reached`);
          break;
        }

        // Check if gap has exceeded retry cap
        if (gap.attempt_count >= GUARD_RAILS.RETRY_CAP) {
          await supabase
            .from('pass_1_5_gap_queue')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', gap.id);
          continue;
        }

        // Get competitor info to check for website
        const { data: competitor } = await supabase
          .from('competitor_facilities')
          .select('website_url')
          .eq('id', gap.competitor_id)
          .maybeSingle();

        const hasWebsite = !!competitor?.website_url;

        // Select appropriate worker
        const workerType = selectWorkerForGap(gap, hasWebsite);

        // Check AI caller specific limits
        if (workerType === 'ai_caller') {
          // Re-check call limit before dispatching
          const { callCount: currentCalls } = await getTodayMetrics(supabase);
          if (currentCalls >= GUARD_RAILS.DAILY_CALL_LIMIT) {
            console.log(`[${PROCESS_ID}] Daily call limit reached, skipping AI caller`);
            continue;
          }
        }

        // Dispatch worker
        const result = await dispatchWorker(supabase, supabaseUrl, supabaseKey, gap, workerType);
        if (result.success) {
          processedCount++;
        }
      }

      console.log(`[${PROCESS_ID}] Processed ${processedCount} gaps`);

      const response: OrchestratorOutput = {
        process_id: PROCESS_ID,
        version: VERSION,
        run_id,
        status: 'running',
        action,
        queue_summary: await getQueueSummary(supabase, run_id),
        guard_rails: GUARD_RAILS,
        cost_cents_today: costCents,
        calls_today: callCount,
        failure_rate: failureRate,
        kill_switch_active: false,
        processed_count: processedCount,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown action
    return new Response(JSON.stringify({
      process_id: PROCESS_ID,
      version: VERSION,
      status: 'error',
      error: `Unknown action: ${action}`,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${PROCESS_ID}@${VERSION}] ERROR:`, error);
    return new Response(JSON.stringify({
      process_id: PROCESS_ID,
      version: VERSION,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
