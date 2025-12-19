import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS0_ORCHESTRATOR Edge Function
 * 
 * DOCTRINE: Lovable orchestrates. Routes based on CCA profile.
 * - Queries ref.cca_county_profile for pass0_method
 * - Routes to correct worker based on method
 * - Never decides automation method itself
 * 
 * process_id: pass0_orchestrator
 * version: v2.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorInput {
  trigger: 'cron' | 'manual';
  dry_run?: boolean;
  sources?: SourceConfig[];
  kill_switches?: Record<string, boolean>;
  county_id?: string;  // If specified, use CCA routing
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

interface CCAProfile {
  pass0_method: string;
  pass0_source_url: string | null;
  pass0_automation_confidence: number | null;
}

const PIPELINE_STEPS = [
  'source_fetcher',
  'content_parser', 
  'geo_resolver',
  'zip_mapper',
  'pin_emitter'
];

// Worker mapping based on CCA pass0_method
const PASS0_WORKER_MAP: Record<string, string> = {
  'scrape_energov': 'pass0_source_fetcher',  // Uses EnerGov scraper
  'scrape_onestop': 'pass0_source_fetcher',  // Uses OneStop scraper
  'scrape_accela': 'pass0_source_fetcher',   // Uses Accela scraper
  'api_permit': 'pass0_source_fetcher',      // Uses API connector
  'scrape_custom': 'pass0_source_fetcher',   // Custom scraper
  'manual': 'manual_queue',                   // Queue for human operator
};

async function getNeonConnection() {
  const neonUrl = Deno.env.get('NEON_DATABASE_URL');
  if (!neonUrl) return null;
  try {
    return postgres(neonUrl, { ssl: 'require' });
  } catch {
    return null;
  }
}

async function getCCAProfile(sql: any, countyId: string): Promise<CCAProfile | null> {
  try {
    const result = await sql`
      SELECT pass0_method, pass0_source_url, pass0_automation_confidence
      FROM ref.cca_county_profile
      WHERE county_id = ${countyId}
      LIMIT 1
    `;
    return result[0] || null;
  } catch (error) {
    console.log(`[PASS0_ORCHESTRATOR] CCA profile lookup failed for ${countyId}:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const input: OrchestratorInput = await req.json().catch(() => ({ trigger: 'manual' }));
    const run_id = crypto.randomUUID();
    const startTime = Date.now();
    const killSwitches = input.kill_switches || {};

    console.log(`[PASS0_ORCHESTRATOR] Starting run ${run_id} (trigger: ${input.trigger}, dry_run: ${input.dry_run})`);

    // =========================================================================
    // CCA ROUTING: If county_id provided, route based on CCA profile
    // =========================================================================
    let ccaProfile: CCAProfile | null = null;
    if (input.county_id) {
      sql = await getNeonConnection();
      if (sql) {
        ccaProfile = await getCCAProfile(sql, input.county_id);
        if (ccaProfile) {
          console.log(`[PASS0_ORCHESTRATOR] CCA profile found: method=${ccaProfile.pass0_method}`);
          
          // If method is 'manual', queue for human and return early
          if (ccaProfile.pass0_method === 'manual') {
            await supabase.from('pass0_run_log').insert({
              run_id,
              step: 'cca_routing',
              status: 'queued_manual',
              metadata: { 
                county_id: input.county_id,
                pass0_method: 'manual',
                reason: 'No automation available for this county'
              }
            });
            
            await sql.end();
            return new Response(
              JSON.stringify({
                status: 'queued_manual',
                run_id,
                county_id: input.county_id,
                message: 'County requires manual data collection',
                next_action: 'Human operator review required'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    // Check global kill switch
    const { data: killCheck } = await supabase
      .from('pass0_run_log')
      .select('kill_switch')
      .eq('kill_switch', true)
      .limit(1);

    if (killCheck && killCheck.length > 0) {
      console.log('[PASS0_ORCHESTRATOR] Global kill switch active - aborting');
      if (sql) await sql.end();
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

    // Cleanup Neon connection
    if (sql) await sql.end();

    return new Response(
      JSON.stringify({
        status: 'complete',
        run_id,
        trigger: input.trigger,
        dry_run: input.dry_run ?? false,
        duration_ms: totalDuration,
        cca_profile: ccaProfile ? {
          pass0_method: ccaProfile.pass0_method,
          pass0_source_url: ccaProfile.pass0_source_url,
        } : null,
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
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
