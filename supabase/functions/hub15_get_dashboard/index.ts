/**
 * PROCESS: hub15.get_dashboard
 * VERSION: v1.0.0
 * 
 * PURPOSE: Read-only API for Hub 1.5 dashboard data.
 * Returns queue status counts and recent attempt logs.
 * 
 * NO SIDE EFFECTS — pure read operation
 * DO NOT MODIFY — UI depends on this shape
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ================================================================
// CONSTANTS
// ================================================================
const PROCESS_ID = 'hub15.get_dashboard';
const VERSION = 'v1.0.0';

// Guard rail thresholds (matching orchestrator)
const DAILY_COST_CAP_CENTS = 5000;  // $50
const DAILY_CALL_LIMIT = 500;
const FAILURE_RATE_THRESHOLD = 0.4; // 40%

// ================================================================
// INPUT CONTRACT
// ================================================================
interface DashboardInput {
  run_id?: string;                 // Optional: filter to specific run
  include_attempts?: boolean;      // Include recent attempt logs
  limit?: number;                  // Max attempts to return (default 50)
}

// ================================================================
// OUTPUT CONTRACT
// ================================================================
interface DashboardOutput {
  process_id: string;
  version: string;
  run_id?: string;
  queue_summary: {
    pending: number;
    in_progress: number;
    resolved: number;
    failed: number;
    killed: number;
    total: number;
  };
  cost_summary: {
    total_cents: number;
    scraper_cents: number;
    ai_caller_cents: number;
  };
  performance: {
    success_rate: number;          // 0.0 to 1.0
    avg_duration_ms: number;
    total_attempts: number;
  };
  guard_rail_status: {
    cost_cap_remaining_cents: number;
    daily_calls_remaining: number;
    failure_rate: number;
    kill_switch_active: boolean;
  };
  recent_attempts?: AttemptLogEntry[];
  gaps_by_status?: GapQueueEntry[];
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

  try {
    // Support both GET with query params and POST with body
    let input: DashboardInput = {};
    if (req.method === 'POST') {
      input = await req.json();
    } else {
      const url = new URL(req.url);
      input = {
        run_id: url.searchParams.get('run_id') || undefined,
        include_attempts: url.searchParams.get('include_attempts') !== 'false',
        limit: parseInt(url.searchParams.get('limit') || '50'),
      };
    }

    const limit = Math.min(input.limit || 50, 200); // Cap at 200

    console.log(`[${PROCESS_ID}@${VERSION}] Fetching dashboard data for run_id=${input.run_id || 'ALL'}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ================================================================
    // QUERY 1: Gap Queue Status Counts
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

    // Calculate status counts
    const queueSummary = {
      pending: 0,
      in_progress: 0,
      resolved: 0,
      failed: 0,
      killed: 0,
      total: gaps?.length || 0,
    };

    (gaps || []).forEach(gap => {
      switch (gap.status) {
        case 'pending': queueSummary.pending++; break;
        case 'in_progress': queueSummary.in_progress++; break;
        case 'resolved': queueSummary.resolved++; break;
        case 'failed': queueSummary.failed++; break;
        case 'killed': queueSummary.killed++; break;
      }
    });

    // ================================================================
    // QUERY 2: Attempt Logs for Performance Metrics
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

    // Calculate cost summary
    const costSummary = {
      total_cents: 0,
      scraper_cents: 0,
      ai_caller_cents: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;
    let completedAttempts = 0;
    let terminalAttempts = 0;

    (attempts || []).forEach(attempt => {
      const cost = attempt.cost_cents || 0;
      costSummary.total_cents += cost;
      
      if (attempt.worker_type === 'scraper') {
        costSummary.scraper_cents += cost;
      } else if (attempt.worker_type === 'ai_caller') {
        costSummary.ai_caller_cents += cost;
      }

      if (attempt.duration_ms) {
        totalDuration += attempt.duration_ms;
        durationCount++;
      }

      // Count terminal attempts (not 'started')
      if (attempt.status !== 'started') {
        terminalAttempts++;
        if (attempt.status === 'completed') {
          completedAttempts++;
        }
      }
    });

    // Calculate performance metrics
    const totalAttempts = attempts?.length || 0;
    const successRate = terminalAttempts > 0 ? completedAttempts / terminalAttempts : 0;
    const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    const failureRate = terminalAttempts > 0 ? 1 - successRate : 0;

    // ================================================================
    // QUERY 3: Today's cost and call count for guard rails
    // ================================================================
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let todayQuery = supabase
      .from('pass_1_5_attempt_log')
      .select('cost_cents, worker_type')
      .gte('created_at', todayStart.toISOString());

    if (input.run_id) {
      todayQuery = todayQuery.eq('run_id', input.run_id);
    }

    const { data: todayAttempts, error: todayError } = await todayQuery;

    let todayCostTotal = 0;
    let todayCallCount = 0;

    if (!todayError && todayAttempts) {
      todayAttempts.forEach(attempt => {
        todayCostTotal += attempt.cost_cents || 0;
        if (attempt.worker_type === 'ai_caller') {
          todayCallCount++;
        }
      });
    }

    // Check for active kill switch (any gap with status='killed' in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: killedGaps } = await supabase
      .from('pass_1_5_gap_queue')
      .select('id')
      .eq('status', 'killed')
      .gte('updated_at', oneHourAgo)
      .limit(1);

    const killSwitchActive = (killedGaps?.length || 0) > 0;

    // ================================================================
    // Build Response
    // ================================================================
    
    // Create gap lookup for attempt enrichment
    const gapLookup = new Map<string, GapQueueEntry>();
    (gaps || []).forEach(gap => {
      gapLookup.set(gap.id, gap as GapQueueEntry);
    });

    // Enrich recent attempts with competitor names
    const recentAttempts: AttemptLogEntry[] | undefined = input.include_attempts !== false
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
      run_id: input.run_id,
      queue_summary: queueSummary,
      cost_summary: costSummary,
      performance: {
        success_rate: Math.round(successRate * 100) / 100,
        avg_duration_ms: avgDuration,
        total_attempts: totalAttempts,
      },
      guard_rail_status: {
        cost_cap_remaining_cents: Math.max(0, DAILY_COST_CAP_CENTS - todayCostTotal),
        daily_calls_remaining: Math.max(0, DAILY_CALL_LIMIT - todayCallCount),
        failure_rate: Math.round(failureRate * 100) / 100,
        kill_switch_active: killSwitchActive,
      },
      recent_attempts: recentAttempts,
      gaps_by_status: gaps as GapQueueEntry[],
    };

    console.log(`[${PROCESS_ID}@${VERSION}] Dashboard: ${queueSummary.total} gaps, ${totalAttempts} attempts, success_rate=${successRate.toFixed(2)}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${PROCESS_ID}@${VERSION}] ERROR:`, errorMessage);
    
    return new Response(JSON.stringify({
      process_id: PROCESS_ID,
      version: VERSION,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
