import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * START_PASS2 Edge Function
 *
 * Initiates Pass-2 underwriting for a given Pass-1 run.
 * Includes validation gate to ensure Pass-1 data is complete.
 *
 * Request body:
 *   - pass1_id: string (required) - The ID of the pass1_runs record
 *   - skip_validation: boolean (optional) - Skip validation gate (for testing)
 *   - acreage: number (optional) - Site acreage override
 *   - land_cost_per_acre: number (optional) - Land cost override
 *
 * Response:
 *   - Success: { pass2_id, status, validation }
 *   - Validation blocked: { error, validation }
 *   - Error: { error }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// VALIDATION TYPES (inline to avoid import issues in Deno)
// ============================================================================

interface Pass1ToPass2Validation {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  required_fields: string[];
  optional_fields: string[];
  enrichment_status: {
    competitor_enrichment_ready: boolean;
    call_sheet_ready: boolean;
  };
  validation_meta: {
    validated_at: string;
    pass1_id: string;
    zip: string;
    validation_score: number;
  };
}

// ============================================================================
// INLINE VALIDATION FUNCTION
// (Copied from p1_to_p2_validator.ts for edge function compatibility)
// ============================================================================

const REQUIRED_IDENTITY_FIELDS = ['zip', 'city', 'county', 'state', 'state_id', 'lat', 'lng'];
const REQUIRED_MACRO_FIELDS = ['zip_metadata', 'macro_demand', 'macro_supply', 'hotspot_score'];
const REQUIRED_ZIP_METADATA_FIELDS = ['population', 'income_household_median', 'home_value'];

const MIN_POPULATION = 1000;
const MIN_INCOME = 25000;
const MIN_VIABILITY_SCORE = 20;
const MIN_COMPETITORS_FOR_PRICING = 3;

function validatePass1Data(pass1Run: any): Pass1ToPass2Validation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const required_fields: string[] = [];
  const optional_fields: string[] = [];
  const validatedAt = new Date().toISOString();

  // Extract opportunity-like data from pass1_runs record
  const identity = {
    zip: pass1Run.zip,
    city: pass1Run.city,
    county: pass1Run.county,
    state: pass1Run.state,
    state_id: pass1Run.state_id || pass1Run.state,
    lat: pass1Run.lat,
    lng: pass1Run.lng,
  };

  // 1. IDENTITY VALIDATION
  for (const field of REQUIRED_IDENTITY_FIELDS) {
    const value = (identity as any)[field];
    if (value === undefined || value === null || value === '') {
      blockers.push(`IDENTITY_FIELD_MISSING: ${field} is required`);
    } else {
      required_fields.push(`identity.${field}`);
    }
  }

  // Validate coordinates
  if (identity.lat !== undefined && identity.lng !== undefined) {
    if (identity.lat < 24 || identity.lat > 72 || identity.lng < -180 || identity.lng > -60) {
      warnings.push('IDENTITY_COORDS_SUSPECT: Coordinates may be outside US bounds');
    }
  }

  // 2. PASS-1 RESULTS VALIDATION
  const pass1Results = pass1Run.results || pass1Run.pass1_results || {};

  // Check macro demand
  if (!pass1Results.macro_demand) {
    blockers.push('MACRO_FIELD_MISSING: macro_demand is required');
  } else {
    required_fields.push('pass1_macro.macro_demand');
    if (!pass1Results.macro_demand.demand_sqft || pass1Results.macro_demand.demand_sqft <= 0) {
      blockers.push('DEMAND_INVALID: macro_demand.demand_sqft must be > 0');
    }
    if (!pass1Results.macro_demand.population || pass1Results.macro_demand.population <= 0) {
      blockers.push('DEMAND_INVALID: macro_demand.population must be > 0');
    }
  }

  // Check macro supply
  if (!pass1Results.macro_supply) {
    blockers.push('MACRO_FIELD_MISSING: macro_supply is required');
  } else {
    required_fields.push('pass1_macro.macro_supply');
  }

  // Check hotspot score
  if (!pass1Results.hotspot_score) {
    blockers.push('MACRO_FIELD_MISSING: hotspot_score is required');
  } else {
    required_fields.push('pass1_macro.hotspot_score');
    if (pass1Results.hotspot_score.overall_score === undefined) {
      blockers.push('HOTSPOT_INVALID: hotspot_score.overall_score is required');
    }
    if (!pass1Results.hotspot_score.tier) {
      blockers.push('HOTSPOT_INVALID: hotspot_score.tier is required');
    }
  }

  // Check zip metadata
  const zipMeta = pass1Results.zip_metadata || pass1Run;
  if (zipMeta.population !== undefined) {
    required_fields.push('zip_metadata.population');
    if (zipMeta.population < MIN_POPULATION) {
      warnings.push(`LOW_POPULATION: Population ${zipMeta.population} is below threshold (${MIN_POPULATION})`);
    }
  }

  if (zipMeta.income_household_median !== undefined) {
    required_fields.push('zip_metadata.income_household_median');
    if (zipMeta.income_household_median < MIN_INCOME) {
      warnings.push(`LOW_INCOME: Median income $${zipMeta.income_household_median} is below threshold`);
    }
  }

  // 3. RECOMMENDATION VALIDATION
  const recommendation = pass1Results.recommendation || pass1Run.recommendation || {};
  if (recommendation.viability_score !== undefined) {
    required_fields.push('pass1_recommendation.viability_score');
    if (recommendation.viability_score < MIN_VIABILITY_SCORE) {
      warnings.push(`LOW_VIABILITY: Pass-1 score ${recommendation.viability_score} is below threshold (${MIN_VIABILITY_SCORE})`);
    }
  }

  if (recommendation.proceed_to_pass2 === false) {
    warnings.push('PASS1_RECOMMENDED_SKIP: Pass-1 recommended NOT proceeding to Pass-2');
  }

  // 4. STATUS VALIDATION
  const status = pass1Run.status;
  const validStatuses = ['complete', 'pass1_complete', 'local_scan_complete'];
  if (!validStatuses.includes(status)) {
    blockers.push(`STATUS_INVALID: Current status "${status}" is not valid for Pass-2`);
  } else {
    required_fields.push('status');
  }

  // 5. COMPETITORS CHECK
  const competitors = pass1Results.competitors || [];
  if (competitors.length === 0) {
    warnings.push('NO_COMPETITORS: No competitors found. Pricing will use market defaults.');
  } else if (competitors.length < MIN_COMPETITORS_FOR_PRICING) {
    warnings.push(`FEW_COMPETITORS: Only ${competitors.length} competitors found`);
  }

  // 6. ENRICHMENT STATUS
  const competitorEnrichmentReady = Boolean(pass1Results.competitor_enrichment?.enrichment_complete);
  const callSheetReady = Boolean(pass1Results.call_sheet?.length > 0);

  if (!competitorEnrichmentReady) {
    optional_fields.push('pass1_macro.competitor_enrichment');
  }
  if (!callSheetReady) {
    optional_fields.push('local_scan.call_sheet');
  }

  // 7. CALCULATE SCORE
  const totalRequiredFields = REQUIRED_IDENTITY_FIELDS.length + REQUIRED_MACRO_FIELDS.length + 5;
  const validationScore = Math.round((required_fields.length / totalRequiredFields) * 100);

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    required_fields,
    optional_fields,
    enrichment_status: {
      competitor_enrichment_ready: competitorEnrichmentReady,
      call_sheet_ready: callSheetReady,
    },
    validation_meta: {
      validated_at: validatedAt,
      pass1_id: pass1Run.id || 'unknown',
      zip: pass1Run.zip || 'unknown',
      validation_score: validationScore,
    },
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

    const {
      pass1_id,
      skip_validation = false,
      acreage,
      land_cost_per_acre,
    } = await req.json();

    if (!pass1_id) {
      return new Response(
        JSON.stringify({ error: 'pass1_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass2] Processing pass1_id: ${pass1_id}`);

    // =========================================================================
    // STEP 1: Fetch Pass-1 Run
    // =========================================================================
    const { data: pass1Run, error: fetchError } = await supabase
      .from('pass1_runs')
      .select('*')
      .eq('id', pass1_id)
      .single();

    if (fetchError || !pass1Run) {
      console.error('[start_pass2] Pass 1 not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Pass 1 run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // STEP 2: Run Validation Gate
    // =========================================================================
    const validation = validatePass1Data(pass1Run);

    console.log(`[start_pass2] Validation: ok=${validation.ok}, blockers=${validation.blockers.length}, warnings=${validation.warnings.length}`);

    // Log validation attempt
    await supabase.from('engine_logs').insert({
      engine: 'start_pass2',
      event: 'validation_check',
      payload: {
        pass1_id,
        zip: pass1Run.zip,
        validation_ok: validation.ok,
        blocker_count: validation.blockers.length,
        warning_count: validation.warnings.length,
        validation_score: validation.validation_meta.validation_score,
        skip_validation,
      },
      status: validation.ok ? 'passed' : 'blocked',
    });

    // =========================================================================
    // STEP 3: Handle Validation Failure
    // =========================================================================
    if (!validation.ok && !skip_validation) {
      console.log(`[start_pass2] Validation BLOCKED for ${pass1_id}:`, validation.blockers);

      return new Response(
        JSON.stringify({
          error: 'Pass-1 validation failed. Cannot proceed to Pass-2.',
          validation,
          blockers: validation.blockers,
          warnings: validation.warnings,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (skip_validation && !validation.ok) {
      console.warn(`[start_pass2] Validation skipped despite ${validation.blockers.length} blockers`);
    }

    // =========================================================================
    // STEP 4: Create Pass-2 Run
    // =========================================================================
    const { data: pass2Run, error: insertError } = await supabase
      .from('pass2_runs')
      .insert({
        pass1_id,
        status: 'pending',
        validation_passed: validation.ok,
        validation_score: validation.validation_meta.validation_score,
        warning_count: validation.warnings.length,
        acreage: acreage || null,
        land_cost_per_acre: land_cost_per_acre || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass2] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[start_pass2] Created pass2_runs record: ${pass2Run.id}`);

    // =========================================================================
    // STEP 5: Log Success Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'start_pass2',
      event: 'run_created',
      payload: {
        pass2_id: pass2Run.id,
        pass1_id,
        zip: pass1Run.zip,
        validation_score: validation.validation_meta.validation_score,
        warnings: validation.warnings,
      },
      status: 'queued',
    });

    // =========================================================================
    // STEP 6: Return Response
    // =========================================================================
    return new Response(
      JSON.stringify({
        pass2_id: pass2Run.id,
        status: 'queued',
        validation: {
          ok: validation.ok,
          score: validation.validation_meta.validation_score,
          blockers: validation.blockers,
          warnings: validation.warnings,
          enrichment_status: validation.enrichment_status,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
