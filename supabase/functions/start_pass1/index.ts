import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * START_PASS1 Edge Function
 *
 * Initiates Pass-1 Recon Hub analysis for a given ZIP code.
 * Pass-1 performs market reconnaissance and hotspot identification.
 *
 * Request body:
 *   - zip: string (required) - Target ZIP code
 *   - state: string (required) - Target state
 *   - radius_miles: number (optional) - Radius for competitor search (default: 5)
 *   - min_population: number (optional) - Minimum population threshold (default: 10000)
 *
 * Response:
 *   - Success: { pass1_id, run_id, status, hotspot_score, promoted_to_pass15 }
 *   - Error: { error }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// INLINE ORCHESTRATOR TYPES (for Deno edge function compatibility)
// ============================================================================

interface Pass1Input {
  targetZip: string;
  targetState: string;
  radiusMiles?: number;
  minPopulation?: number;
}

interface Pass1Output {
  pass: 'PASS1';
  runId: string;
  timestamp: string;
  input: Pass1Input;
  zipHydration: any | null;
  radiusBuilder: any | null;
  macroDemand: any | null;
  macroSupply: any | null;
  competitorRegistry: any | null;
  localScan: any | null;
  hotspotScoring: any | null;
  validationGate: any | null;
  hotspotScore: number;
  promotedToPass15: boolean;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

// ============================================================================
// INLINE ORCHESTRATOR (simplified for edge function)
// ============================================================================

async function runPass1Orchestrator(input: Pass1Input): Promise<Pass1Output> {
  const runId = `P1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[PASS1_RECON_HUB] Starting run ${runId}`);

  // Placeholder spoke outputs (would call actual spokes in production)
  const zipHydration = {
    spokeId: 'SS.01.01',
    zipCode: input.targetZip,
    city: 'Sample City',
    county: 'Sample County',
    state: input.targetState,
    population: 45000,
    medianIncome: 65000,
    latitude: 35.0,
    longitude: -85.0,
    timestamp: new Date().toISOString(),
  };

  const radiusBuilder = {
    spokeId: 'SS.01.02',
    centerZip: input.targetZip,
    radiusMiles: input.radiusMiles ?? 5,
    includedZips: [input.targetZip],
    totalPopulation: 120000,
    timestamp: new Date().toISOString(),
  };

  const macroDemand = {
    spokeId: 'SS.01.03',
    populationGrowthRate: 0.025,
    employmentGrowthRate: 0.018,
    medianHomePrice: 285000,
    rentalVacancyRate: 0.045,
    demandScore: 72,
    timestamp: new Date().toISOString(),
  };

  const macroSupply = {
    spokeId: 'SS.01.04',
    existingStorageFacilities: 8,
    totalStorageSqFt: 450000,
    sqFtPerCapita: 3.75,
    supplyScore: 65,
    timestamp: new Date().toISOString(),
  };

  const competitorRegistry = {
    spokeId: 'SS.01.05',
    competitors: [],
    totalCompetitors: 8,
    brandBreakdown: { 'Public Storage': 2, 'Extra Space': 1, 'Independent': 5 },
    timestamp: new Date().toISOString(),
  };

  const localScan = {
    spokeId: 'SS.01.06',
    nearbyAmenities: ['retail', 'residential'],
    trafficScore: 68,
    visibilityScore: 72,
    accessScore: 75,
    timestamp: new Date().toISOString(),
  };

  const hotspotScoring = {
    spokeId: 'SS.01.07',
    hotspotScore: 71,
    demandWeight: 0.4,
    supplyWeight: 0.35,
    competitionWeight: 0.25,
    scoreBreakdown: { demand: 72, supply: 65, competition: 78 },
    tier: 'B' as const,
    timestamp: new Date().toISOString(),
  };

  const validationGate = {
    spokeId: 'SS.01.08',
    passed: true,
    checks: [],
    promotedToPass15: hotspotScoring.hotspotScore >= 60,
    failureReasons: [],
    timestamp: new Date().toISOString(),
  };

  return {
    pass: 'PASS1',
    runId,
    timestamp: new Date().toISOString(),
    input,
    zipHydration,
    radiusBuilder,
    macroDemand,
    macroSupply,
    competitorRegistry,
    localScan,
    hotspotScoring,
    validationGate,
    hotspotScore: hotspotScoring.hotspotScore,
    promotedToPass15: validationGate.promotedToPass15,
    status: 'complete',
    errors: [],
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
      zip,
      state,
      radius_miles = 5,
      min_population = 10000,
    } = await req.json();

    if (!zip || !state) {
      return new Response(
        JSON.stringify({ error: 'zip and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass1] Starting recon for ZIP: ${zip}, State: ${state}`);

    // =========================================================================
    // STEP 1: Run Pass-1 Orchestrator
    // =========================================================================
    const pass1Input: Pass1Input = {
      targetZip: zip,
      targetState: state,
      radiusMiles: radius_miles,
      minPopulation: min_population,
    };

    const pass1Output = await runPass1Orchestrator(pass1Input);

    // =========================================================================
    // STEP 2: Store Pass-1 Results
    // =========================================================================
    const { data: pass1Run, error: insertError } = await supabase
      .from('pass1_runs')
      .insert({
        zip,
        state,
        run_id: pass1Output.runId,
        results: pass1Output,
        hotspot_score: pass1Output.hotspotScore,
        promoted_to_pass15: pass1Output.promotedToPass15,
        status: pass1Output.status,
        // Map to OpportunityObject segments
        city: pass1Output.zipHydration?.city,
        county: pass1Output.zipHydration?.county,
        lat: pass1Output.zipHydration?.latitude,
        lng: pass1Output.zipHydration?.longitude,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass1] Insert error:', insertError);
      throw insertError;
    }

    // =========================================================================
    // STEP 3: Log Engine Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'start_pass1',
      event: 'recon_complete',
      payload: {
        pass1_id: pass1Run.id,
        run_id: pass1Output.runId,
        zip,
        state,
        hotspot_score: pass1Output.hotspotScore,
        promoted_to_pass15: pass1Output.promotedToPass15,
      },
      status: pass1Output.status,
    });

    console.log(`[start_pass1] Completed with hotspot score: ${pass1Output.hotspotScore}`);

    // =========================================================================
    // STEP 4: Return Response
    // =========================================================================
    return new Response(
      JSON.stringify({
        pass1_id: pass1Run.id,
        run_id: pass1Output.runId,
        status: pass1Output.status,
        hotspot_score: pass1Output.hotspotScore,
        promoted_to_pass15: pass1Output.promotedToPass15,
        results: pass1Output,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass1] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
