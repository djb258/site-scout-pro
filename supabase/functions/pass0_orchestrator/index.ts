import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorInput {
  trigger: 'cron' | 'manual';
  dry_run?: boolean;
}

interface StepResult {
  step: string;
  status: 'success' | 'failure' | 'skipped';
  item_count: number;
  duration_ms: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const input: OrchestratorInput = await req.json().catch(() => ({ trigger: 'manual' }));
    const run_id = crypto.randomUUID();
    const startTime = Date.now();

    console.log(`[PASS0_ORCHESTRATOR] Starting run ${run_id} (trigger: ${input.trigger})`);

    // Check kill switch
    const { data: killCheck } = await supabase
      .from('pass0_run_log')
      .select('kill_switch')
      .eq('kill_switch', true)
      .limit(1);

    if (killCheck && killCheck.length > 0) {
      console.log('[PASS0_ORCHESTRATOR] Kill switch active - aborting');
      return new Response(
        JSON.stringify({ status: 'aborted', reason: 'kill_switch_active', run_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const steps = ['source_fetcher', 'geo_resolver', 'zip_mapper', 'pin_emitter'];
    const results: StepResult[] = [];

    // Execute steps in sequence
    for (const step of steps) {
      const stepStart = Date.now();
      
      // Log step start
      await supabase.from('pass0_run_log').insert({
        run_id,
        step,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: { trigger: input.trigger, dry_run: input.dry_run }
      });

      try {
        // Call worker function
        const { data, error } = await supabase.functions.invoke(`pass0_${step}`, {
          body: { run_id, dry_run: input.dry_run }
        });

        if (error) throw error;

        const stepResult: StepResult = {
          step,
          status: 'success',
          item_count: data?.item_count ?? 0,
          duration_ms: Date.now() - stepStart
        };
        results.push(stepResult);

        // Update step log
        await supabase.from('pass0_run_log')
          .update({
            status: 'success',
            ended_at: new Date().toISOString(),
            item_count: data?.item_count ?? 0,
            metadata: { ...data, duration_ms: stepResult.duration_ms }
          })
          .eq('run_id', run_id)
          .eq('step', step);

        console.log(`[PASS0_ORCHESTRATOR] Step ${step} completed: ${data?.item_count ?? 0} items`);

      } catch (stepError) {
        const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown error';
        
        results.push({
          step,
          status: 'failure',
          item_count: 0,
          duration_ms: Date.now() - stepStart,
          error: errorMsg
        });

        await supabase.from('pass0_run_log')
          .update({
            status: 'failure',
            ended_at: new Date().toISOString(),
            failure_count: 1,
            error_message: errorMsg
          })
          .eq('run_id', run_id)
          .eq('step', step);

        console.error(`[PASS0_ORCHESTRATOR] Step ${step} failed: ${errorMsg}`);
        
        // Continue to next step (don't abort on single failure)
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failure').length;

    console.log(`[PASS0_ORCHESTRATOR] Run ${run_id} complete: ${successCount}/${steps.length} steps succeeded in ${totalDuration}ms`);

    return new Response(
      JSON.stringify({
        status: 'complete',
        run_id,
        trigger: input.trigger,
        duration_ms: totalDuration,
        steps: results,
        summary: {
          total: steps.length,
          success: successCount,
          failure: failureCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS0_ORCHESTRATOR] Fatal error:', error);
    return new Response(
      JSON.stringify({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
