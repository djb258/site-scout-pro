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

    const { zip_run_id, notes } = await req.json();

    if (!zip_run_id) {
      return new Response(
        JSON.stringify({ error: 'zip_run_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Vault] Saving run ${zip_run_id} to vault`);

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
      // In production, this would use pg client to insert into Neon
      // For now, we'll store in a local vault table
    }

    // 4. Store in local vault table (create if needed via site_results_staging for now)
    const { error: vaultError } = await supabase
      .from('site_results_staging')
      .insert({
        site_intake_id: null,
        json_payload: vaultRecord,
        saturation_score: (pass2Data.fusion_model as any)?.demand_score || 0,
        parcel_viability_score: (pass2Data.fusion_model as any)?.overall_score || 0,
        county_difficulty: 50, // Would come from zoning complexity
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

  } catch (error: any) {
    console.error('[Vault] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
