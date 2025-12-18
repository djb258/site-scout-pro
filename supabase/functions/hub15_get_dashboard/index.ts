/**
 * PROCESS: hub15.get_dashboard
 * VERSION: v1.1.0
 * 
 * // DOCTRINE LOCKED — PASS 1.5 COMPLETE
 * PURPOSE: Read-only API for Hub 1.5 dashboard data.
 * Returns queue status counts, attempt stats, cost totals, and guard-rail health.
 *
 * ZERO MUTATIONS — pure read operation
 * DO NOT MODIFY — UI depends on this shape
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ================================================================
// CONSTANTS
// ================================================================
const PROCESS_ID = 'hub15.get_dashboard';
const VERSION = 'v1.1.0';

// Guard rail thresholds (matching orchestrator/kill_switch)
const DAILY_COST_CAP_CENTS = 5000;  // $50
const DAILY_CALL_LIMIT = 500;
const FAILURE_RATE_THRESHOLD = 0.4; // 40%

// ================================================================
// INPUT CONTRACT
// ================================================================
interface DashboardInput {
  run_id?: string;                 // Optional: filter to specific run
  include_attempts?: boolean;      // Include recent attempt logs (default true)
  include_gaps?: boolean;          // Include gap entries (default false)
  limit?: number;                  // Max attempts to return (default 50, max 200)
}

// ================================================================
// OUTPUT CONTRACT
// ================================================================
interface DashboardOutput {
  process_id: string;
  version: string;
  generated_at: string;
  run_id?: string;
  
  queue_summary: {
    total: number;
    by_status: {
      pending: number;
      in_progress: number;
      resolved: number;
      failed: number;
      killed: number;
    };
    by_priority: {
      critical: number;
      high: number;
      normal: number;
      low: number;
    };
    by_gap_type: {
      missing_rate: number;
      low_confidence: number;
      no_phone: number;
      no_scrape_data: number;
      other: number;
    };
    by_worker: {
      ai_caller: number;
      scraper: number;
      unassigned: number;
    };
  };
  
  cost_summary: {
    total_cents: number;
    today_cents: number;
    by_worker: {
      scraper_cents: number;
      ai_caller_cents: number;
    };
  };
  
  performance: {
    total_attempts: number;
    terminal_attempts: number;
    completed_count: number;
    failed_count: number;
    success_rate: number;          // 0.0 to 1.0
    failure_rate: number;          // 0.0 to 1.0
    avg_duration_ms: number;
    avg_cost_cents: number;
  };
  
  guard_rail_status: {
    cost_cap_remaining_cents: number;
    cost_cap_used_percent: number;
    daily_calls_remaining: number;
    daily_calls_used_percent: number;
    failure_rate: number;
    failure_rate_breach: boolean;
    kill_switch_active: boolean;
    health: 'green' | 'yellow' | 'red';
  };
  
  recent_attempts?: AttemptLogEntry[];
  gaps?: GapQueueEntry[];
}

interface AttemptLogEntry {
  id: string;
  gap_queue_id: string;
  competitor_name?: string;
  worker_type: string;
  attempt_number: number;
  status: string;
  duration_ms?: number;
  cost_cents?: number;
  error_code?: string;
  error_message?: string;
  created_at: string;
}

interface GapQueueEntry {
  id: string;
  competitor_id: string;
  competitor_name: string;
  competitor_address?: string;
  gap_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  priority: string;
  assigned_worker?: string;
  created_at: string;
  updated_at: string;
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
    // ================================================================
    // PARSE INPUT (GET or POST)
    // ================================================================
    let input: DashboardInput = {};
    
    if (req.method === 'POST') {
      const body = await req.text();
      if (body) {
        input = JSON.parse(body);
      }
    } else {
      const url = new URL(req.url);
      input = {
        run_id: url.searchParams.get('run_id') || undefined,
        include_attempts: url.searchParams.get('include_attempts') !== 'false',
        include_gaps: url.searchParams.get('include_gaps') === 'true',
        limit: parseInt(url.searchParams.get('limit') || '50'),
      };
    }

    const limit = Math.min(Math.max(input.limit || 50, 1), 200);
    const includeAttempts = input.include_attempts !== false;
    const includeGaps = input.include_gaps === true;

    console.log(`[${PROCESS_ID}@${VERSION}] Fetching dashboard data | run_id=${input.run_id || 'ALL'} | include_attempts=${includeAttempts} | include_gaps=${includeGaps}`);

    // ================================================================
    // INIT SUPABASE CLIENT
    // ================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('MISSING_ENV: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ================================================================
    // QUERY 1: Gap Queue (for status, priority, gap_type, worker breakdown)
    // ================================================================
    let gapQuery = supabase
      .from('pass_1_5_gap_queue')
      .select('id, status, competitor_id, competitor_name, competitor_address, gap_type, attempt_count, max_attempts, priority, assigned_worker, created_at, updated_at');
    
    if (input.run_id) {
      gapQuery = gapQuery.eq('run_id', input.run_id);
    }

    const { data: gaps, error: gapError } = await gapQuery;

    if (gapError) {
      throw new Error(`GAP_QUERY_FAILED: ${gapError.message}`);
    }

    // Aggregate queue summary
    const queueSummary = {
      total: gaps?.length || 0,
      by_status: { pending: 0, in_progress: 0, resolved: 0, failed: 0, killed: 0 },
      by_priority: { critical: 0, high: 0, normal: 0, low: 0 },
      by_gap_type: { missing_rate: 0, low_confidence: 0, no_phone: 0, no_scrape_data: 0, other: 0 },
      by_worker: { ai_caller: 0, scraper: 0, unassigned: 0 },
    };

    const gapLookup = new Map<string, GapQueueEntry>();

    (gaps || []).forEach(gap => {
      gapLookup.set(gap.id, gap as GapQueueEntry);
      
      // Status aggregation
      const status = gap.status as keyof typeof queueSummary.by_status;
      if (status in queueSummary.by_status) {
        queueSummary.by_status[status]++;
      }
      
      // Priority aggregation
      const priority = gap.priority as keyof typeof queueSummary.by_priority;
      if (priority in queueSummary.by_priority) {
        queueSummary.by_priority[priority]++;
      }
      
      // Gap type aggregation
      const gapType = gap.gap_type as keyof typeof queueSummary.by_gap_type;
      if (gapType in queueSummary.by_gap_type) {
        queueSummary.by_gap_type[gapType]++;
      } else {
        queueSummary.by_gap_type.other++;
      }
      
      // Worker aggregation
      if (gap.assigned_worker === 'ai_caller') {
        queueSummary.by_worker.ai_caller++;
      } else if (gap.assigned_worker === 'scraper') {
        queueSummary.by_worker.scraper++;
      } else {
        queueSummary.by_worker.unassigned++;
      }
    });

    // ================================================================
    // QUERY 2: All Attempt Logs (for performance metrics)
    // ================================================================
    let attemptQuery = supabase
      .from('pass_1_5_attempt_log')
      .select('id, gap_queue_id, worker_type, attempt_number, status, duration_ms, cost_cents, error_code, error_message, created_at')
      .order('created_at', { ascending: false });
    
    if (input.run_id) {
      attemptQuery = attemptQuery.eq('run_id', input.run_id);
    }

    const { data: attempts, error: attemptError } = await attemptQuery;

    if (attemptError) {
      throw new Error(`ATTEMPT_QUERY_FAILED: ${attemptError.message}`);
    }

    // Calculate cost and performance metrics
    const costSummary = {
      total_cents: 0,
      today_cents: 0,
      by_worker: { scraper_cents: 0, ai_caller_cents: 0 },
    };

    let totalDuration = 0;
    let durationCount = 0;
    let totalCostForAvg = 0;
    let costCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let terminalAttempts = 0;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    let todayCallCount = 0;

    (attempts || []).forEach(attempt => {
      const cost = attempt.cost_cents || 0;
      costSummary.total_cents += cost;
      
      // Track by worker type
      if (attempt.worker_type === 'scraper') {
        costSummary.by_worker.scraper_cents += cost;
      } else if (attempt.worker_type === 'ai_caller') {
        costSummary.by_worker.ai_caller_cents += cost;
      }

      // Duration tracking
      if (attempt.duration_ms && attempt.duration_ms > 0) {
        totalDuration += attempt.duration_ms;
        durationCount++;
      }

      // Cost averaging (only non-zero)
      if (cost > 0) {
        totalCostForAvg += cost;
        costCount++;
      }

      // Terminal status tracking (not 'started')
      if (attempt.status !== 'started') {
        terminalAttempts++;
        if (attempt.status === 'completed') {
          completedCount++;
        } else if (['failed', 'timeout', 'killed', 'cost_exceeded'].includes(attempt.status)) {
          failedCount++;
        }
      }

      // Today's metrics for guard rails
      if (attempt.created_at >= todayStartIso) {
        costSummary.today_cents += cost;
        if (attempt.worker_type === 'ai_caller') {
          todayCallCount++;
        }
      }
    });

    const totalAttempts = attempts?.length || 0;
    const successRate = terminalAttempts > 0 ? completedCount / terminalAttempts : 0;
    const failureRate = terminalAttempts > 0 ? failedCount / terminalAttempts : 0;
    const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    const avgCost = costCount > 0 ? Math.round(totalCostForAvg / costCount) : 0;

    // ================================================================
    // QUERY 3: Kill Switch Check (any killed gap in last hour)
    // ================================================================
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: killedGaps } = await supabase
      .from('pass_1_5_gap_queue')
      .select('id')
      .eq('status', 'killed')
      .gte('updated_at', oneHourAgo)
      .limit(1);

    const killSwitchActive = (killedGaps?.length || 0) > 0;

    // ================================================================
    // COMPUTE GUARD RAIL HEALTH
    // ================================================================
    const costCapRemainingCents = Math.max(0, DAILY_COST_CAP_CENTS - costSummary.today_cents);
    const costCapUsedPercent = Math.round((costSummary.today_cents / DAILY_COST_CAP_CENTS) * 100);
    const dailyCallsRemaining = Math.max(0, DAILY_CALL_LIMIT - todayCallCount);
    const dailyCallsUsedPercent = Math.round((todayCallCount / DAILY_CALL_LIMIT) * 100);
    const failureRateBreach = failureRate >= FAILURE_RATE_THRESHOLD;

    // Health status: red if kill switch or any breach, yellow if >75% used, green otherwise
    let health: 'green' | 'yellow' | 'red' = 'green';
    if (killSwitchActive || failureRateBreach || costCapUsedPercent >= 100 || dailyCallsUsedPercent >= 100) {
      health = 'red';
    } else if (costCapUsedPercent >= 75 || dailyCallsUsedPercent >= 75 || failureRate >= 0.25) {
      health = 'yellow';
    }

    // ================================================================
    // BUILD RESPONSE
    // ================================================================
    const recentAttempts: AttemptLogEntry[] | undefined = includeAttempts
      ? (attempts || []).slice(0, limit).map(attempt => ({
          id: attempt.id,
          gap_queue_id: attempt.gap_queue_id,
          competitor_name: gapLookup.get(attempt.gap_queue_id)?.competitor_name,
          worker_type: attempt.worker_type,
          attempt_number: attempt.attempt_number,
          status: attempt.status,
          duration_ms: attempt.duration_ms,
          cost_cents: attempt.cost_cents,
          error_code: attempt.error_code,
          error_message: attempt.error_message,
          created_at: attempt.created_at,
        }))
      : undefined;

    const response: DashboardOutput = {
      process_id: PROCESS_ID,
      version: VERSION,
      generated_at: new Date().toISOString(),
      run_id: input.run_id,
      queue_summary: queueSummary,
      cost_summary: costSummary,
      performance: {
        total_attempts: totalAttempts,
        terminal_attempts: terminalAttempts,
        completed_count: completedCount,
        failed_count: failedCount,
        success_rate: Math.round(successRate * 1000) / 1000,
        failure_rate: Math.round(failureRate * 1000) / 1000,
        avg_duration_ms: avgDuration,
        avg_cost_cents: avgCost,
      },
      guard_rail_status: {
        cost_cap_remaining_cents: costCapRemainingCents,
        cost_cap_used_percent: costCapUsedPercent,
        daily_calls_remaining: dailyCallsRemaining,
        daily_calls_used_percent: dailyCallsUsedPercent,
        failure_rate: Math.round(failureRate * 1000) / 1000,
        failure_rate_breach: failureRateBreach,
        kill_switch_active: killSwitchActive,
        health,
      },
      recent_attempts: recentAttempts,
      gaps: includeGaps ? (gaps as GapQueueEntry[]) : undefined,
    };

    const duration = Date.now() - startTime;
    console.log(`[${PROCESS_ID}@${VERSION}] Dashboard complete | ${queueSummary.total} gaps | ${totalAttempts} attempts | success_rate=${successRate.toFixed(3)} | health=${health} | ${duration}ms`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    console.error(`[${PROCESS_ID}@${VERSION}] ERROR: ${errorMessage} | ${duration}ms`);
    
    return new Response(JSON.stringify({
      process_id: PROCESS_ID,
      version: VERSION,
      generated_at: new Date().toISOString(),
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
