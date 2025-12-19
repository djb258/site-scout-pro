import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GET_READINESS_STATUS Edge Function
 * 
 * Returns production readiness status for the UI panel.
 * Aggregates checks across all passes.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckResult {
  id: string;
  name: string;
  pass: number;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const checks: CheckResult[] = [];

    // Check 1: Master Failure Log table exists
    const { error: failureLogError } = await supabase
      .from('master_failure_log')
      .select('id')
      .limit(1);
    
    checks.push({
      id: 'master_failure_log',
      name: 'Master Failure Log Active',
      pass: 0,
      status: failureLogError ? 'fail' : 'pass',
      message: failureLogError ? failureLogError.message : 'Table accessible',
    });

    // Check 2: Pass 1 census data exists
    const { data: censusData, error: censusError } = await supabase
      .from('pass1_census_snapshot')
      .select('id')
      .limit(1);
    
    checks.push({
      id: 'pass1_census',
      name: 'Pass 1 Census Snapshots',
      pass: 1,
      status: censusError ? 'fail' : (censusData && censusData.length > 0 ? 'pass' : 'warning'),
      message: censusError ? censusError.message : (censusData && censusData.length > 0 ? 'Data exists' : 'No data found'),
    });

    // Check 3: Pass 1.5 gap queue
    const { data: queueData, error: queueError } = await supabase
      .from('pass_1_5_gap_queue')
      .select('status')
      .limit(10);
    
    checks.push({
      id: 'pass15_queue',
      name: 'Pass 1.5 Gap Queue Working',
      pass: 15,
      status: queueError ? 'fail' : 'pass',
      message: queueError ? queueError.message : `${queueData?.length || 0} items in queue`,
    });

    // Check 4: Recent failures count
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentFailures } = await supabase
      .from('master_failure_log')
      .select('id, severity')
      .gte('created_at', oneDayAgo);
    
    const criticalCount = recentFailures?.filter(f => f.severity === 'critical').length || 0;
    const errorCount = recentFailures?.filter(f => f.severity === 'error').length || 0;
    
    checks.push({
      id: 'recent_errors',
      name: 'Recent Error Count (24h)',
      pass: 0,
      status: criticalCount > 0 ? 'fail' : (errorCount > 5 ? 'warning' : 'pass'),
      message: `${criticalCount} critical, ${errorCount} errors in last 24h`,
    });

    // Aggregate results
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warning').length;

    return new Response(JSON.stringify({
      is_ready: failCount === 0,
      blocking_count: failCount,
      warning_count: warnCount,
      checks,
      checked_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GET_READINESS_STATUS] Error:', error);
    return new Response(JSON.stringify({
      is_ready: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
