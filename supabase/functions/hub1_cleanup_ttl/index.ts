import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// HUB 1 TTL CLEANUP JOB
// Frequency: Daily (scheduled via pg_cron)
// Action: Delete Hub 1 records where ttl_expires_at < now()
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  const now = new Date().toISOString();

  console.log(`[HUB1_CLEANUP] Starting TTL cleanup at ${now}`);

  try {
    // Delete expired run logs
    const { data: deletedRuns, error: runError } = await supabase
      .from('hub1_pass1_run_log')
      .delete()
      .lt('ttl_expires_at', now)
      .select('id');

    if (runError) {
      console.error('[HUB1_CLEANUP] Error deleting run logs:', runError);
      throw runError;
    }

    // Delete expired error logs
    const { data: deletedErrors, error: errorLogError } = await supabase
      .from('hub1_pass1_error_log')
      .delete()
      .lt('ttl_expires_at', now)
      .select('id');

    if (errorLogError) {
      console.error('[HUB1_CLEANUP] Error deleting error logs:', errorLogError);
      throw errorLogError;
    }

    const runCount = deletedRuns?.length || 0;
    const errorCount = deletedErrors?.length || 0;
    const runtime_ms = Date.now() - startTime;

    const summary = {
      success: true,
      deleted_run_logs: runCount,
      deleted_error_logs: errorCount,
      total_deleted: runCount + errorCount,
      runtime_ms,
      executed_at: now
    };

    console.log(`[HUB1_CLEANUP] Completed: Deleted ${runCount} run logs, ${errorCount} error logs in ${runtime_ms}ms`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[HUB1_CLEANUP] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      executed_at: now
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
