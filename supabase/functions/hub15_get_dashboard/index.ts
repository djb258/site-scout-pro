/**
 * PROCESS: hub15.get_dashboard
 * VERSION: v0.1.0 (SHELL ONLY)
 * 
 * PURPOSE: Read-only API for Hub 1.5 dashboard data.
 * Returns queue status counts and recent attempt logs.
 * 
 * NO SIDE EFFECTS — pure read operation
 * 
 * TODO: Query pass_1_5_gap_queue for status counts
 * TODO: Query pass_1_5_attempt_log for recent attempts
 * TODO: Calculate cost totals
 * TODO: Calculate failure rate
 * 
 * DO NOT ADD BUSINESS LOGIC — this is a shell only
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

interface AttemptLogEntry {
  id: string;
  gap_queue_id: string;
  worker_type: string;
  attempt_number: number;
  status: string;
  duration_ms?: number;
  cost_cents?: number;
  error_code?: string;
  created_at: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processId = 'hub15.get_dashboard';
  const version = 'v0.1.0';

  try {
    // Support both GET with query params and POST with body
    let input: DashboardInput = {};
    if (req.method === 'POST') {
      input = await req.json();
    } else {
      const url = new URL(req.url);
      input = {
        run_id: url.searchParams.get('run_id') || undefined,
        include_attempts: url.searchParams.get('include_attempts') === 'true',
        limit: parseInt(url.searchParams.get('limit') || '50'),
      };
    }
    
    // TODO: Query pass_1_5_gap_queue for status counts
    // TODO: Query pass_1_5_attempt_log for performance metrics
    // TODO: Calculate cost totals from attempt logs
    // TODO: Check guard rail thresholds

    console.log(`[${processId}@${version}] STUB: Fetching dashboard data for run_id=${input.run_id || 'ALL'}`);

    // STUB RESPONSE — replace with actual implementation
    const response: DashboardOutput = {
      process_id: processId,
      version: version,
      run_id: input.run_id,
      queue_summary: {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        failed: 0,
        killed: 0,
        total: 0,
      },
      cost_summary: {
        total_cents: 0,
        scraper_cents: 0,
        ai_caller_cents: 0,
      },
      performance: {
        success_rate: 0,
        avg_duration_ms: 0,
        total_attempts: 0,
      },
      guard_rail_status: {
        cost_cap_remaining_cents: 5000,   // $50 initial
        daily_calls_remaining: 500,
        failure_rate: 0,
        kill_switch_active: false,
      },
      recent_attempts: input.include_attempts ? [] : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${processId}@${version}] ERROR:`, error);
    return new Response(JSON.stringify({
      process_id: processId,
      version: version,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
