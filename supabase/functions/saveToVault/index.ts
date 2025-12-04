import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Neon connection (configured via secrets)
const NEON_DATABASE_URL = Deno.env.get('NEON_DATABASE_URL');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    
    // Support both old (zip_run_id) and new (pass2_id) schemas
    const { zip_run_id, pass2_id, notes } = body;

    // NEW SCHEMA: pass2_id from pass1_runs/pass2_runs
    if (pass2_id) {
      console.log(`[saveToVault] Processing pass2_id: ${pass2_id}`);

      // Fetch pass2_runs with related pass1_runs
      const { data: pass2Run, error: pass2Error } = await supabase
        .from('pass2_runs')
        .select('*, pass1_runs(*)')
        .eq('id', pass2_id)
        .single();

      if (pass2Error || !pass2Run) {
        console.error('[saveToVault] Pass 2 not found:', pass2Error);
        return new Response(
          JSON.stringify({ error: 'Pass 2 run not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pass1Run = (pass2Run as any).pass1_runs;

      // Build the Neon vault payload
      const neonPayload = {
        zip: pass1Run.zip,
        county: pass1Run.radius_counties?.[0]?.county || null,
        state: pass1Run.radius_counties?.[0]?.state || null,
        feasibility: pass2Run.feasibility,
        reverse_feasibility: pass2Run.reverse_feasibility,
        fusion_model: pass2Run.fusion_model,
        rent_benchmarks: pass2Run.rent_benchmarks,
        market_analysis: {
          gemini_facilities: pass1Run.gemini_facilities,
          gemini_housing: pass1Run.gemini_housing,
          gemini_anchors: pass1Run.gemini_anchors,
          gemini_recreation: pass1Run.gemini_recreation,
          gemini_industry_news: pass1Run.gemini_industry_news
        },
        jurisdiction: pass2Run.zoning_intel,
        industrial: pass2Run.industrial_deep_dive,
        housing_pipeline: pass2Run.housing_pipeline,
        competitor_summary: pass1Run.gemini_facilities,
        final_verdict: (pass2Run.verdict as any)?.decision || 'WALK',
        toggles: pass1Run.toggles,
        timestamp: new Date().toISOString()
      };

      // Create staging_payload
      const { data: staging, error: stagingError } = await supabase
        .from('staging_payload')
        .insert({
          pass2_id,
          payload: neonPayload
        })
        .select()
        .single();

      if (stagingError) {
        console.error('[saveToVault] Staging error:', stagingError);
        throw stagingError;
      }

      // Create vault_push_queue entry
      const { data: queueEntry, error: queueError } = await supabase
        .from('vault_push_queue')
        .insert({
          staging_id: staging.id,
          neon_payload: neonPayload,
          status: 'pending'
        })
        .select()
        .single();

      if (queueError) {
        console.error('[saveToVault] Queue error:', queueError);
        throw queueError;
      }

      console.log(`[saveToVault] Created queue entry: ${queueEntry.id}`);

      // Log engine event
      await supabase.from('engine_logs').insert({
        engine: 'saveToVault',
        event: 'vault_queued',
        payload: { queue_id: queueEntry.id, pass2_id, zip: pass1Run.zip },
        status: 'pending'
      });

      // TODO: POST to Neon ingestion API when configured
      if (NEON_DATABASE_URL) {
        console.log('[saveToVault] Neon configured - would push to external vault');
      }

      return new Response(
        JSON.stringify({ 
          status: 'submitted_to_neon',
          queue_id: queueEntry.id,
          staging_id: staging.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LEGACY SCHEMA: zip_run_id from zip_runs/pass1_results/pass2_results
    if (!zip_run_id) {
      return new Response(
        JSON.stringify({ error: 'Either zip_run_id or pass2_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Vault] Saving run ${zip_run_id} to vault (legacy schema)`);

    // 1. Fetch all data for this run
    const { data: zipRun, error: runError } = await supabase
      .from('zip_runs')
      .select('*')
      .eq('id', zip_run_id)
      .single();

    if (runError || !zipRun) {
      return new Response(
        JSON.stringify({ error: 'Zip run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: pass1Data } = await supabase
      .from('pass1_results')
      .select('*')
      .eq('zip_run_id', zip_run_id)
      .single();

    const { data: pass2Data } = await supabase
      .from('pass2_results')
      .select('*')
      .eq('zip_run_id', zip_run_id)
      .single();

    if (!pass1Data || !pass2Data) {
      return new Response(
        JSON.stringify({ error: 'Both Pass 1 and Pass 2 must be complete before saving to vault' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Transform to vault format
    const vaultRecord = {
      id: zip_run_id,
      zip_code: zipRun.zip_code,
      analysis_mode: zipRun.analysis_mode,
      created_at: zipRun.created_at,
      saved_at: new Date().toISOString(),
      notes: notes || null,
      
      // Jurisdiction card
      jurisdiction: {
        zip: zipRun.zip_code,
        city: (pass1Data.zip_metadata as any)?.city || 'Unknown',
        state: (pass1Data.zip_metadata as any)?.state_name || 'Unknown',
        county: (pass1Data.zip_metadata as any)?.county_name || 'Unknown',
        population: (pass1Data.zip_metadata as any)?.population || 0
      },
      
      // Viability summary
      viability_summary: {
        pass1_score: (pass1Data.analysis_summary as any)?.viability_score || 0,
        pass2_score: (pass2Data.fusion_model as any)?.overall_score || 0,
        final_verdict: (pass2Data.verdict as any)?.decision || 'UNKNOWN',
        confidence: (pass2Data.verdict as any)?.confidence || 0
      },
      
      // Full data bundles
      feasibility_bundle: {
        feasibility: pass2Data.feasibility,
        reverse_feasibility: pass2Data.reverse_feasibility,
        rent_benchmarks: pass2Data.rent_benchmarks
      },
      
      fusion_model_output: pass2Data.fusion_model,
      
      industrial_intel: {
        pass1: pass1Data.industrial_signals,
        pass2: pass2Data.industrial_deep
      },
      
      verdict_packet: {
        verdict: pass2Data.verdict,
        zoning: pass2Data.zoning,
        permit_intel: pass2Data.permit_intel,
        housing_pipeline: pass2Data.housing_pipeline
      },
      
      // Toggles used
      analysis_config: {
        urban_exclude: zipRun.urban_exclude,
        multifamily_priority: zipRun.multifamily_priority,
        recreation_load: zipRun.recreation_load,
        industrial_momentum: zipRun.industrial_momentum
      }
    };

    // 3. If Neon is configured, save to external vault
    if (NEON_DATABASE_URL) {
      console.log('[Vault] Neon configured - would save to external vault');
    }

    // 4. Store in local vault table
    const { error: vaultError } = await supabase
      .from('site_results_staging')
      .insert({
        site_intake_id: null,
        json_payload: vaultRecord,
        saturation_score: (pass2Data.fusion_model as any)?.demand_score || 0,
        parcel_viability_score: (pass2Data.fusion_model as any)?.overall_score || 0,
        county_difficulty: 50,
        financial_viability: (pass2Data.feasibility as any)?.roi_5yr ? 80 : 50,
        final_score: (pass2Data.fusion_model as any)?.overall_score || 0,
        decision: (pass2Data.verdict as any)?.decision || 'EVALUATE',
        status: 'vault_saved',
        frontend_user_id: zip_run_id
      });

    if (vaultError) {
      console.error('[Vault] Error saving:', vaultError);
      throw vaultError;
    }

    // 5. Update zip_run status
    await supabase
      .from('zip_runs')
      .update({ status: 'saved' })
      .eq('id', zip_run_id);

    console.log(`[Vault] Successfully saved ${zipRun.zip_code} to vault`);

    return new Response(
      JSON.stringify({
        success: true,
        zip_run_id,
        status: 'saved',
        vault_record: vaultRecord
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Vault] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
