import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * START_PASS3 Edge Function — DECISION SHELL ONLY
 *
 * Pass 3 performs NO underwriting math and NO recalculation.
 * It consumes immutable artifacts from Pass 1, Pass 1.5, and Pass 2.
 *
 * PURPOSE:
 *   - Fetch read-only artifact data
 *   - Accept decision parameters (GO/HOLD/NO-GO)
 *   - Require explicit rationale
 *   - Emit decision record for Neon persistence
 *
 * ACTIONS:
 *   - "fetch_artifact": Get read-only data for display
 *   - "submit_decision": Record decision with rationale
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPE DEFINITIONS — Decision Shell Contract
// ============================================================================

type DecisionType = 'GO' | 'HOLD' | 'NO_GO';
type PhaseScope = 'PHASE_1_ONLY' | 'FULL_BUILD' | 'LAND_BANK';
type TimingIntent = 'IMMEDIATE' | 'WITHIN_6_MO' | 'WITHIN_12_MO' | 'OPPORTUNISTIC';
type ConfidenceClass = 'HIGH' | 'MEDIUM' | 'LOW';
type LifecycleStatus = 'ACTIVE' | 'SUPERSEDED' | 'CLOSED';

interface Pass3FetchInput {
  action: 'fetch_artifact';
  artifact_id: string;  // References upstream compiled artifact
  zip?: string;         // Optional ZIP for context
}

interface Pass3DecisionInput {
  action: 'submit_decision';
  artifact_id: string;
  zip: string;
  decision: DecisionType;
  phase_scope: PhaseScope;
  timing_intent: TimingIntent;
  confidence_class: ConfidenceClass;
  rationale: string;    // REQUIRED - no silent approval
  supersedes_run_id?: string;  // If superseding a previous decision
}

interface ArtifactData {
  // From Pass 1
  pass1_demand_gap_sqft: number | null;
  pass1_supply_sqft: number | null;
  pass1_population: number | null;
  pass1_zip_count: number | null;
  
  // From Pass 1.5
  pass15_rent_low: number | null;
  pass15_rent_medium: number | null;
  pass15_rent_high: number | null;
  pass15_confidence: string | null;
  
  // From Pass 2
  pass2_status: string | null;
  pass2_feasibility_flag: boolean | null;
  pass2_dscr: number | null;
  pass2_zoning_status: string | null;
  pass2_civil_status: string | null;
  pass2_prohibitions: string[];
  pass2_missing_fields: string[];
}

interface Pass3ArtifactResponse {
  artifact_id: string;
  zip: string | null;
  artifact_data: ArtifactData;
  artifact_valid: boolean;
  validation_errors: string[];
  previous_decisions: Array<{
    run_id: string;
    decision: DecisionType;
    created_at: string;
    status: LifecycleStatus;
  }>;
}

interface Pass3DecisionResponse {
  pass3_run_id: string;
  artifact_id: string;
  zip: string;
  decision: DecisionType;
  phase_scope: PhaseScope;
  timing_intent: TimingIntent;
  confidence_class: ConfidenceClass;
  rationale: string;
  lifecycle_status: LifecycleStatus;
  created_at: string;
  payload_for_neon: object;
}

// ============================================================================
// ARTIFACT FETCHER — Read-Only Data Assembly
// ============================================================================

async function fetchArtifactData(
  supabase: any,
  artifactId: string,
  zip?: string
): Promise<Pass3ArtifactResponse> {
  const validationErrors: string[] = [];
  
  // Initialize empty artifact data
  const artifactData: ArtifactData = {
    pass1_demand_gap_sqft: null,
    pass1_supply_sqft: null,
    pass1_population: null,
    pass1_zip_count: null,
    pass15_rent_low: null,
    pass15_rent_medium: null,
    pass15_rent_high: null,
    pass15_confidence: null,
    pass2_status: null,
    pass2_feasibility_flag: null,
    pass2_dscr: null,
    pass2_zoning_status: null,
    pass2_civil_status: null,
    pass2_prohibitions: [],
    pass2_missing_fields: [],
  };

  let resolvedZip = zip;

  // Try to resolve ZIP from artifact_id if it looks like a zip_run_id
  if (!resolvedZip) {
    const { data: zipRun } = await supabase
      .from('zip_runs')
      .select('zip_code')
      .eq('id', artifactId)
      .single();
    
    if (zipRun) {
      resolvedZip = zipRun.zip_code;
    }
  }

  // =========================================================================
  // PASS 1 DATA — Demand Gap, Supply, Population
  // =========================================================================
  
  // Try pass1_demand_agg
  const { data: demandAgg } = await supabase
    .from('pass1_demand_agg')
    .select('*')
    .eq('run_id', artifactId)
    .limit(10);

  if (demandAgg && demandAgg.length > 0) {
    const totalDemand = demandAgg.reduce((sum: number, d: any) => sum + (d.baseline_demand_sqft || 0), 0);
    const totalPop = demandAgg.reduce((sum: number, d: any) => sum + (d.population_total || 0), 0);
    artifactData.pass1_demand_gap_sqft = totalDemand;
    artifactData.pass1_population = totalPop;
    artifactData.pass1_zip_count = demandAgg.length;
  }

  // Try pass1_supply_agg
  const { data: supplyAgg } = await supabase
    .from('pass1_supply_agg')
    .select('*')
    .eq('run_id', artifactId)
    .limit(10);

  if (supplyAgg && supplyAgg.length > 0) {
    artifactData.pass1_supply_sqft = supplyAgg.reduce((sum: number, s: any) => sum + (s.supply_sqft_total || 0), 0);
  }

  // =========================================================================
  // PASS 1.5 DATA — Rent Benchmarks
  // =========================================================================
  
  if (resolvedZip) {
    const { data: rentStaging } = await supabase
      .from('rent_band_staging')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (rentStaging) {
      artifactData.pass15_rent_low = rentStaging.low_rent;
      artifactData.pass15_rent_medium = rentStaging.medium_rent;
      artifactData.pass15_rent_high = rentStaging.high_rent;
      artifactData.pass15_confidence = rentStaging.status;
    }
  }

  // =========================================================================
  // PASS 2 DATA — Feasibility, Zoning, Civil Status
  // =========================================================================
  
  // Try pass2_results
  const { data: pass2Result } = await supabase
    .from('pass2_results')
    .select('*')
    .eq('zip_run_id', artifactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (pass2Result) {
    const verdict = pass2Result.verdict || {};
    const feasibility = pass2Result.feasibility || {};
    const zoning = pass2Result.zoning || {};
    
    artifactData.pass2_status = verdict.status || verdict.decision || 'UNKNOWN';
    artifactData.pass2_feasibility_flag = feasibility.viable === true;
    artifactData.pass2_dscr = feasibility.dscr || null;
    artifactData.pass2_zoning_status = zoning.status || 'NOT_CHECKED';
    artifactData.pass2_civil_status = zoning.civil_status || 'NOT_CHECKED';
    artifactData.pass2_prohibitions = verdict.fatal_prohibitions || [];
    artifactData.pass2_missing_fields = verdict.missing_required_fields || [];
  }

  // Also try pass2_runs for backup
  if (!pass2Result) {
    const { data: pass2Run } = await supabase
      .from('pass2_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pass2Run) {
      const verdict = pass2Run.verdict || {};
      const feasibility = pass2Run.feasibility || {};
      const zoning = pass2Run.zoning_intel || {};
      
      artifactData.pass2_status = verdict.status || pass2Run.status || 'UNKNOWN';
      artifactData.pass2_feasibility_flag = feasibility.viable === true;
      artifactData.pass2_dscr = feasibility.dscr || null;
      artifactData.pass2_zoning_status = zoning.status || 'NOT_CHECKED';
    }
  }

  // =========================================================================
  // VALIDATION — Check for required data
  // =========================================================================

  if (artifactData.pass1_demand_gap_sqft === null) {
    validationErrors.push('Missing Pass 1 demand data');
  }
  if (artifactData.pass2_status === null) {
    validationErrors.push('Missing Pass 2 constraint status');
  }
  if (artifactData.pass2_prohibitions.length > 0) {
    validationErrors.push(`${artifactData.pass2_prohibitions.length} fatal prohibition(s) present`);
  }
  if (artifactData.pass2_missing_fields.length > 0) {
    validationErrors.push(`${artifactData.pass2_missing_fields.length} required field(s) missing`);
  }

  // =========================================================================
  // PREVIOUS DECISIONS — Lifecycle Tracking
  // =========================================================================

  const { data: previousDecisions } = await supabase
    .from('engine_logs')
    .select('*')
    .eq('engine', 'pass3_decision')
    .order('created_at', { ascending: false })
    .limit(10);

  const formattedPreviousDecisions = (previousDecisions || [])
    .filter((d: any) => d.payload?.artifact_id === artifactId)
    .map((d: any) => ({
      run_id: d.payload?.pass3_run_id || d.id,
      decision: d.payload?.decision || 'UNKNOWN',
      created_at: d.created_at,
      status: d.payload?.lifecycle_status || 'ACTIVE',
    }));

  return {
    artifact_id: artifactId,
    zip: resolvedZip || null,
    artifact_data: artifactData,
    artifact_valid: validationErrors.length === 0,
    validation_errors: validationErrors,
    previous_decisions: formattedPreviousDecisions,
  };
}

// ============================================================================
// DECISION RECORDER — Submit Decision with Rationale
// ============================================================================

async function submitDecision(
  supabase: any,
  input: Pass3DecisionInput
): Promise<Pass3DecisionResponse> {
  // Generate unique run ID
  const pass3RunId = `P3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = new Date().toISOString();

  // Validate rationale is present (no silent approval)
  if (!input.rationale || input.rationale.trim().length < 10) {
    throw new Error('Rationale is required and must be at least 10 characters. No silent approval allowed.');
  }

  // If superseding, mark previous as superseded
  if (input.supersedes_run_id) {
    await supabase
      .from('engine_logs')
      .update({
        payload: supabase.sql`payload || '{"lifecycle_status": "SUPERSEDED"}'::jsonb`,
      })
      .eq('engine', 'pass3_decision')
      .filter('payload->pass3_run_id', 'eq', input.supersedes_run_id);
  }

  // Build Neon-ready payload
  const neonPayload = {
    pass3_run_id: pass3RunId,
    artifact_id: input.artifact_id,
    zip: input.zip,
    decision: input.decision,
    phase_scope: input.phase_scope,
    timing_intent: input.timing_intent,
    confidence_class: input.confidence_class,
    rationale: input.rationale,
    lifecycle_status: 'ACTIVE' as LifecycleStatus,
    supersedes_run_id: input.supersedes_run_id || null,
    created_at: createdAt,
    schema_version: 'v1.0',
  };

  // Log decision to engine_logs (Supabase staging)
  const { error: logError } = await supabase
    .from('engine_logs')
    .insert({
      engine: 'pass3_decision',
      event: 'decision_recorded',
      payload: neonPayload,
      status: input.decision,
    });

  if (logError) {
    console.error('[start_pass3] Decision log error:', logError);
  }

  return {
    pass3_run_id: pass3RunId,
    artifact_id: input.artifact_id,
    zip: input.zip,
    decision: input.decision,
    phase_scope: input.phase_scope,
    timing_intent: input.timing_intent,
    confidence_class: input.confidence_class,
    rationale: input.rationale,
    lifecycle_status: 'ACTIVE',
    created_at: createdAt,
    payload_for_neon: neonPayload,
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const action = body.action || 'fetch_artifact';

    console.log(`[start_pass3] Action: ${action}`);

    // =========================================================================
    // ACTION: FETCH ARTIFACT
    // =========================================================================
    if (action === 'fetch_artifact') {
      const { artifact_id, zip } = body;

      if (!artifact_id) {
        return new Response(
          JSON.stringify({ error: 'artifact_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const artifactResponse = await fetchArtifactData(supabase, artifact_id, zip);

      return new Response(
        JSON.stringify(artifactResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION: SUBMIT DECISION
    // =========================================================================
    if (action === 'submit_decision') {
      const { artifact_id, zip, decision, phase_scope, timing_intent, confidence_class, rationale, supersedes_run_id } = body;

      // Validate required fields
      if (!artifact_id || !zip || !decision || !phase_scope || !timing_intent || !confidence_class || !rationale) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields',
            required: ['artifact_id', 'zip', 'decision', 'phase_scope', 'timing_intent', 'confidence_class', 'rationale'],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate decision type
      if (!['GO', 'HOLD', 'NO_GO'].includes(decision)) {
        return new Response(
          JSON.stringify({ error: 'decision must be GO, HOLD, or NO_GO' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const decisionResponse = await submitDecision(supabase, {
        action: 'submit_decision',
        artifact_id,
        zip,
        decision,
        phase_scope,
        timing_intent,
        confidence_class,
        rationale,
        supersedes_run_id,
      });

      return new Response(
        JSON.stringify(decisionResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}. Use 'fetch_artifact' or 'submit_decision'` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass3] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
