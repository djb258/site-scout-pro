/**
 * PROCESS: hub15.kill_switch
 * VERSION: v1.0.0
 * 
 * PURPOSE: Emergency halt for Hub 1.5 remediation workers.
 * Immediately stops all in-progress jobs and marks them as 'killed'.
 * 
 * TRIGGERS (automatic):
 * - Cost cap exceeded ($50/run or 10% of budget)
 * - Failure rate > 70%
 * - Daily call limit reached (500/day)
 * - Manual admin action
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ================================================================
// INPUT CONTRACT
// ================================================================
interface KillSwitchInput {
  run_id?: string;                 // Optional: kill specific run, or all if omitted
  reason: 'cost_cap' | 'failure_rate' | 'daily_limit' | 'manual' | 'timeout';
  triggered_by: 'system' | 'admin';
  metadata?: Record<string, unknown>;
}

// ================================================================
// OUTPUT CONTRACT
// ================================================================
interface KillSwitchOutput {
  process_id: string;
  version: string;
  status: 'killed' | 'error';
  run_id?: string;
  gaps_killed: number;
  reason: string;
  triggered_at: string;
  total_cost_cents: number;
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

  const processId = 'hub15.kill_switch';
  const version = 'v1.0.0';

  try {
    const input: KillSwitchInput = await req.json();
    
    console.log(`[${processId}@${version}] Kill switch triggered. reason=${input.reason}, triggered_by=${input.triggered_by}, run_id=${input.run_id || 'ALL'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update all in_progress gaps to 'killed' status
    let query = supabase
      .from('pass_1_5_gap_queue')
      .update({ 
        status: 'killed', 
        updated_at: new Date().toISOString() 
      })
      .eq('status', 'in_progress');

    if (input.run_id) {
      query = query.eq('run_id', input.run_id);
    }

    const { data: killedGaps, error: updateError } = await query.select('id');

    if (updateError) {
      console.error(`[${processId}] Error killing gaps:`, updateError);
      throw updateError;
    }

    const gapsKilled = killedGaps?.length || 0;
    console.log(`[${processId}] Killed ${gapsKilled} in-progress gaps`);

    // Get total cost for this run
    let totalCostCents = 0;
    if (input.run_id) {
      const { data: costData } = await supabase
        .from('ai_cost_tracker')
        .select('cost_cents')
        .eq('run_id', input.run_id);

      totalCostCents = (costData || []).reduce((sum, row) => sum + (row.cost_cents || 0), 0);
    }

    // Log kill event to attempt log
    await supabase.from('pass_1_5_attempt_log').insert({
      run_id: input.run_id || '00000000-0000-0000-0000-000000000000',
      attempt_number: 0,
      worker_type: 'kill_switch',
      status: 'killed',
      error_code: input.reason.toUpperCase(),
      error_message: `Kill switch activated: ${input.reason}`,
      duration_ms: 0,
      cost_cents: 0,
      metadata: {
        gaps_killed: gapsKilled,
        triggered_by: input.triggered_by,
        total_cost_cents: totalCostCents,
        ...input.metadata,
      },
    });

    // Track the kill switch event
    await supabase.from('ai_cost_tracker').insert({
      run_id: input.run_id || '00000000-0000-0000-0000-000000000000',
      service: 'kill_switch',
      operation: input.reason,
      cost_cents: 0,
      metadata: {
        gaps_killed: gapsKilled,
        triggered_by: input.triggered_by,
      },
    });

    const response: KillSwitchOutput = {
      process_id: processId,
      version: version,
      status: 'killed',
      run_id: input.run_id,
      gaps_killed: gapsKilled,
      reason: input.reason,
      triggered_at: new Date().toISOString(),
      total_cost_cents: totalCostCents,
    };

    console.log(`[${processId}] Kill switch completed successfully`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${processId}@${version}] ERROR:`, error);
    return new Response(JSON.stringify({
      process_id: processId,
      version: version,
      status: 'error',
      gaps_killed: 0,
      reason: 'error',
      triggered_at: new Date().toISOString(),
      total_cost_cents: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
