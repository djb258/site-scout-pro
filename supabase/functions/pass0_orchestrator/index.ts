import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorInput {
  trigger: 'cron' | 'manual';
  dry_run?: boolean;
  sources?: SourceConfig[];
  kill_switches?: Record<string, boolean>;
}

interface SourceConfig {
  source_id: string;
  type: string;
  enabled: boolean;
}

interface StepResult {
  step: string;
  status: 'success' | 'failure' | 'skipped';
  item_count: number;
  duration_ms: number;
  error?: string;
  data?: any;
}

const PIPELINE_STEPS = [
  'source_fetcher',
  'content_parser', 
  'geo_resolver',
  'zip_mapper',
  'pin_emitter'
];

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
    const killSwitches = input.kill_switches || {};

    console.log(`[PASS0_ORCHESTRATOR] Starting run ${run_id} (trigger: ${input.trigger}, dry_run: ${input.dry_run})`);

    // Check global kill switch
    const { data: killCheck } = await supabase
      .from('pass0_run_log')
      .select('kill_switch')
      .eq('kill_switch', true)
      .limit(1);

    if (killCheck && killCheck.length > 0) {
      console.log('[PASS0_ORCHESTRATOR] Global kill switch active - aborting');
      return new Response(
        JSON.stringify({ status: 'aborted', reason: 'kill_switch_active', run_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: StepResult[] = [];
    let currentItems: any[] = [];

    // Execute steps in sequence, passing data between them
    for (const step of PIPELINE_STEPS) {
      const stepStart = Date.now();
      
      // Check per-stage kill switch
      if (killSwitches[step]) {
        console.log(`[PASS0_ORCHESTRATOR] Kill switch active for ${step} - skipping`);
        results.push({
          step,
          status: 'skipped',
          item_count: 0,
          duration_ms: 0,
          error: 'Kill switch active'
        });
        continue;
      }
      
      // Log step start
      await supabase.from('pass0_run_log').insert({
        run_id,
        step,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: { trigger: input.trigger, dry_run: input.dry_run }
      });

      try {
        // Build request body based on step
        let requestBody: any = { 
          run_id, 
          dry_run: input.dry_run 
        };
        
        if (step === 'source_fetcher') {
          requestBody.sources = input.sources;
        } else {
          // Pass items from previous step
          requestBody.items = currentItems;
        }

        // Call worker function
        const { data, error } = await supabase.functions.invoke(`pass0_${step}`, {
          body: requestBody
        });

        if (error) throw error;

        const stepResult: StepResult = {
          step,
          status: 'success',
          item_count: data?.item_count ?? 0,
          duration_ms: Date.now() - stepStart,
          data: data
        };
        results.push(stepResult);

        // Update items for next step
        if (data?.items) {
          currentItems = data.items;
        }

        // Update step log
        await supabase.from('pass0_run_log')
          .update({
            status: 'success',
            ended_at: new Date().toISOString(),
            item_count: data?.item_count ?? 0,
            metadata: { 
              duration_ms: stepResult.duration_ms,
              logs: data?.logs
            }
          })
          .eq('run_id', run_id)
          .eq('step', step);

        console.log(`[PASS0_ORCHESTRATOR] Step ${step} completed: ${data?.item_count ?? 0} items in ${stepResult.duration_ms}ms`);

        // If no items to process, short-circuit the rest of the pipeline
        if (currentItems.length === 0 && step !== 'pin_emitter') {
          console.log(`[PASS0_ORCHESTRATOR] No items after ${step} - stopping pipeline`);
          break;
        }

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
        
        // Don't continue pipeline on failure
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failure').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    // Calculate total pins emitted
    const pinEmitterResult = results.find(r => r.step === 'pin_emitter');
    const totalPins = pinEmitterResult?.item_count ?? 0;

    console.log(`[PASS0_ORCHESTRATOR] Run ${run_id} complete: ${successCount}/${PIPELINE_STEPS.length} steps succeeded, ${totalPins} pins emitted in ${totalDuration}ms`);

    return new Response(
      JSON.stringify({
        status: 'complete',
        run_id,
        trigger: input.trigger,
        dry_run: input.dry_run ?? false,
        duration_ms: totalDuration,
        steps: results,
        summary: {
          total: PIPELINE_STEPS.length,
          success: successCount,
          failure: failureCount,
          skipped: skippedCount,
          pins_emitted: totalPins
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
