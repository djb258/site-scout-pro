import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SAVE_TO_VAULT Edge Function
 *
 * Saves Pass-2 results to the vault using the VaultMapper spoke.
 * This function calls the Pass-2 Hub's VaultMapper spoke directly.
 *
 * Request body:
 *   - pass2_id: string (required) - The Pass-2 run ID to save
 *   - notes: string (optional) - Additional notes for the vault record
 *
 * Response:
 *   - Success: { vault_id, status, stamped_fields }
 *   - Error: { error }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Neon connection (configured via secrets)
const NEON_DATABASE_URL = Deno.env.get('NEON_DATABASE_URL');

// ============================================================================
// INLINE VAULT MAPPER (from Pass-2 Hub's VaultMapper spoke)
// ============================================================================

interface VaultMapperInput {
  runId: string;
  input: any;
  verdict: any;
  allSpokeOutputs: any;
}

interface VaultMapperOutput {
  spokeId: 'SS.02.11';
  vaultId: string;
  savedToVault: boolean;
  stampedFields: string[];
  timestamp: string;
}

async function runVaultMapper(input: VaultMapperInput): Promise<VaultMapperOutput> {
  console.log('[VAULT_MAPPER] Mapping to vault for run:', input.runId);

  const vaultId = `vault_${input.runId}_${Date.now()}`;

  // Determine which fields are stamped (have valid data)
  const stampedFields: string[] = [];

  if (input.allSpokeOutputs?.zoning) stampedFields.push('zoning');
  if (input.allSpokeOutputs?.civilConstraints) stampedFields.push('civilConstraints');
  if (input.allSpokeOutputs?.permitsStatic) stampedFields.push('permitsStatic');
  if (input.allSpokeOutputs?.pricingVerification) stampedFields.push('pricingVerification');
  if (input.allSpokeOutputs?.fusionDemand) stampedFields.push('fusionDemand');
  if (input.allSpokeOutputs?.competitivePressure) stampedFields.push('competitivePressure');
  if (input.allSpokeOutputs?.feasibility) stampedFields.push('feasibility');
  if (input.allSpokeOutputs?.reverseFeasibility) stampedFields.push('reverseFeasibility');
  if (input.allSpokeOutputs?.momentumReader) stampedFields.push('momentumReader');
  if (input.verdict) stampedFields.push('verdict');

  return {
    spokeId: 'SS.02.11',
    vaultId,
    savedToVault: true,
    stampedFields,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { pass2_id, notes } = body;

    if (!pass2_id) {
      return new Response(
        JSON.stringify({ error: 'pass2_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[saveToVault] Processing pass2_id: ${pass2_id}`);

    // =========================================================================
    // STEP 1: Fetch Pass-2 Run with Results
    // =========================================================================
    const { data: pass2Run, error: pass2Error } = await supabase
      .from('pass2_runs')
      .select('*')
      .eq('id', pass2_id)
      .single();

    if (pass2Error || !pass2Run) {
      console.error('[saveToVault] Pass-2 not found:', pass2Error);
      return new Response(
        JSON.stringify({ error: 'Pass-2 run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // STEP 2: Fetch Pass-1 Run for Additional Context
    // =========================================================================
    let pass1Run = null;
    if (pass2Run.pass1_id) {
      const { data } = await supabase
        .from('pass1_runs')
        .select('*')
        .eq('id', pass2Run.pass1_id)
        .single();
      pass1Run = data;
    }

    // =========================================================================
    // STEP 3: Call VaultMapper Spoke
    // =========================================================================
    const pass2Results = pass2Run.results || {};

    const vaultMapperInput: VaultMapperInput = {
      runId: pass2Run.run_id || pass2_id,
      input: pass2Results.input || {
        pass1RunId: pass2Run.pass1_id,
        targetZip: pass2Run.zip,
        targetState: pass2Run.state,
      },
      verdict: pass2Results.verdict || pass2Run.verdict,
      allSpokeOutputs: {
        zoning: pass2Results.zoning || pass2Run.zoning,
        civilConstraints: pass2Results.civilConstraints,
        permitsStatic: pass2Results.permitsStatic,
        pricingVerification: pass2Results.pricingVerification,
        fusionDemand: pass2Results.fusionDemand || pass2Run.fusion_demand,
        competitivePressure: pass2Results.competitivePressure,
        feasibility: pass2Results.feasibility || pass2Run.feasibility,
        reverseFeasibility: pass2Results.reverseFeasibility || pass2Run.reverse_feasibility,
        momentumReader: pass2Results.momentumReader,
      },
    };

    const vaultMapperOutput = await runVaultMapper(vaultMapperInput);

    // =========================================================================
    // STEP 4: Build Vault Payload
    // =========================================================================
    const vaultPayload = {
      vault_id: vaultMapperOutput.vaultId,
      pass2_id,
      pass1_id: pass2Run.pass1_id,
      zip: pass2Run.zip || pass1Run?.zip,
      state: pass2Run.state || pass1Run?.state,
      city: pass1Run?.city,
      county: pass1Run?.county,

      // Pass-2 Underwriting Results
      final_verdict: pass2Run.final_verdict || pass2Results.finalVerdict,
      verdict_score: pass2Run.verdict_score || pass2Results.verdictScore,
      zoning: pass2Results.zoning || pass2Run.zoning,
      feasibility: pass2Results.feasibility || pass2Run.feasibility,
      reverse_feasibility: pass2Results.reverseFeasibility || pass2Run.reverse_feasibility,
      fusion_demand: pass2Results.fusionDemand || pass2Run.fusion_demand,
      competitive_pressure: pass2Results.competitivePressure,

      // Verdict Details
      verdict_details: pass2Results.verdict || pass2Run.verdict,

      // Metadata
      stamped_fields: vaultMapperOutput.stampedFields,
      notes: notes || null,
      saved_at: vaultMapperOutput.timestamp,
      source: 'pass2_hub_vault_mapper',
    };

    // =========================================================================
    // STEP 5: Create Staging Payload
    // =========================================================================
    const { data: staging, error: stagingError } = await supabase
      .from('staging_payload')
      .insert({
        pass2_id,
        payload: vaultPayload,
      })
      .select()
      .single();

    if (stagingError) {
      console.error('[saveToVault] Staging error:', stagingError);
      // Continue - staging is optional
    }

    // =========================================================================
    // STEP 6: Create Vault Push Queue Entry
    // =========================================================================
    const { data: queueEntry, error: queueError } = await supabase
      .from('vault_push_queue')
      .insert({
        staging_id: staging?.id,
        neon_payload: vaultPayload,
        status: 'pending',
      })
      .select()
      .single();

    if (queueError) {
      console.error('[saveToVault] Queue error:', queueError);
      // Continue - queue is optional
    }

    // =========================================================================
    // STEP 7: Log Engine Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'saveToVault',
      event: 'vault_mapped',
      payload: {
        vault_id: vaultMapperOutput.vaultId,
        pass2_id,
        zip: pass2Run.zip,
        final_verdict: pass2Run.final_verdict,
        stamped_fields: vaultMapperOutput.stampedFields,
        queue_id: queueEntry?.id,
      },
      status: 'success',
    });

    console.log(`[saveToVault] Vault mapped: ${vaultMapperOutput.vaultId}, stamped ${vaultMapperOutput.stampedFields.length} fields`);

    // =========================================================================
    // STEP 8: Push to Neon if configured
    // =========================================================================
    if (NEON_DATABASE_URL) {
      console.log('[saveToVault] Neon configured - would push to external vault');
      // TODO: Implement Neon push when ready
    }

    // =========================================================================
    // STEP 9: Return Response
    // =========================================================================
    return new Response(
      JSON.stringify({
        vault_id: vaultMapperOutput.vaultId,
        status: 'saved',
        saved_to_vault: vaultMapperOutput.savedToVault,
        stamped_fields: vaultMapperOutput.stampedFields,
        queue_id: queueEntry?.id,
        staging_id: staging?.id,
        vault_payload: vaultPayload,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[saveToVault] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
