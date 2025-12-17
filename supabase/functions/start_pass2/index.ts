import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * START_PASS2 Edge Function
 *
 * Initiates Pass-2 Underwriting Hub analysis.
 * Pass-2 performs site-specific underwriting and feasibility analysis.
 *
 * Request body:
 *   - pass1_id: string (required) - The Pass-1 run ID
 *   - pass15_id: string (optional) - The Pass-1.5 run ID (for rate verification)
 *   - zip: string (required) - Target ZIP code
 *   - state: string (required) - Target state
 *   - parcel_id: string (optional) - Specific parcel ID
 *   - address: string (optional) - Site address
 *   - latitude: number (optional) - Site latitude
 *   - longitude: number (optional) - Site longitude
 *   - acreage: number (optional) - Site acreage
 *
 * Response:
 *   - Success: { pass2_id, run_id, status, final_verdict, verdict_score }
 *   - Error: { error }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// INLINE ORCHESTRATOR TYPES (for Deno edge function compatibility)
// ============================================================================

interface Pass2Input {
  pass1RunId: string;
  pass15RunId?: string;
  targetZip: string;
  targetState: string;
  parcelId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  acreage?: number;
}

interface Pass2Output {
  pass: 'PASS2';
  runId: string;
  timestamp: string;
  input: Pass2Input;
  zoning: any | null;
  civilConstraints: any | null;
  permitsStatic: any | null;
  pricingVerification: any | null;
  fusionDemand: any | null;
  competitivePressure: any | null;
  feasibility: any | null;
  reverseFeasibility: any | null;
  momentumReader: any | null;
  verdict: any | null;
  vaultMapper: any | null;
  finalVerdict: 'GO' | 'NO_GO' | 'MAYBE';
  verdictScore: number;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

// ============================================================================
// INLINE ORCHESTRATOR (simplified for edge function)
// ============================================================================

async function runPass2Orchestrator(input: Pass2Input): Promise<Pass2Output> {
  const runId = `P2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[PASS2_UNDERWRITING_HUB] Starting run ${runId}`);

  // Placeholder spoke outputs (would call actual spokes in production)
  const zoning = {
    spokeId: 'SS.02.01',
    zoningCode: 'C-2',
    zoningDescription: 'General Commercial',
    storageAllowed: true,
    conditionalUse: false,
    setbacks: { front: 25, side: 10, rear: 10 },
    maxHeight: 35,
    maxCoverage: 0.7,
    timestamp: new Date().toISOString(),
  };

  const civilConstraints = {
    spokeId: 'SS.02.02',
    floodZone: 'X',
    wetlands: false,
    slope: 2.5,
    soilType: 'Sandy Loam',
    utilities: { water: true, sewer: true, electric: true, gas: true },
    constraints: [],
    timestamp: new Date().toISOString(),
  };

  const permitsStatic = {
    spokeId: 'SS.02.03',
    recentPermits: [],
    avgPermitTime: 90,
    jurisdictionDifficulty: 'moderate' as const,
    timestamp: new Date().toISOString(),
  };

  const pricingVerification = {
    spokeId: 'SS.02.04',
    verifiedRates: [
      { unitSize: '10x10', rate: 125, source: 'market' },
      { unitSize: '10x20', rate: 195, source: 'market' },
    ],
    marketRateAvg: { '10x10': 125, '10x20': 195 },
    confidenceLevel: 'medium' as const,
    timestamp: new Date().toISOString(),
  };

  const fusionDemand = {
    spokeId: 'SS.02.05',
    fusedDemandScore: 74,
    populationDensity: 2500,
    householdGrowth: 0.028,
    incomeLevel: 68000,
    demandDrivers: ['population growth', 'multifamily development'],
    timestamp: new Date().toISOString(),
  };

  const competitivePressure = {
    spokeId: 'SS.02.06',
    pressureScore: 62,
    nearestCompetitorMiles: 1.8,
    competitorsIn3Miles: 4,
    competitorsIn5Miles: 8,
    marketSaturation: 'medium' as const,
    timestamp: new Date().toISOString(),
  };

  const feasibility = {
    spokeId: 'SS.02.07',
    feasible: true,
    estimatedUnits: 450,
    estimatedSqFt: 52000,
    estimatedRevenue: 780000,
    estimatedNOI: 520000,
    capRate: 0.065,
    dscr: 1.35,
    timestamp: new Date().toISOString(),
  };

  const reverseFeasibility = {
    spokeId: 'SS.02.08',
    maxLandPrice: 850000,
    breakEvenOccupancy: 0.72,
    sensitivityAnalysis: [],
    timestamp: new Date().toISOString(),
  };

  const momentumReader = {
    spokeId: 'SS.02.09',
    momentumScore: 68,
    trendDirection: 'up' as const,
    pass0RunId: null,
    timestamp: new Date().toISOString(),
  };

  const verdict = {
    spokeId: 'SS.02.10',
    verdict: 'GO' as const,
    score: 76,
    weights: { zoning: 0.15, feasibility: 0.3, demand: 0.25, competition: 0.2, momentum: 0.1 },
    fatalFlaws: [],
    strengths: ['Strong demand drivers', 'Favorable zoning', 'Good feasibility metrics'],
    weaknesses: ['Moderate competition within 3 miles'],
    recommendation: 'Proceed to Pass-3 for detailed pro forma analysis',
    timestamp: new Date().toISOString(),
  };

  const vaultMapper = {
    spokeId: 'SS.02.11',
    vaultId: `vault_${runId}`,
    savedToVault: false,
    stampedFields: ['zoning', 'feasibility', 'verdict'],
    timestamp: new Date().toISOString(),
  };

  return {
    pass: 'PASS2',
    runId,
    timestamp: new Date().toISOString(),
    input,
    zoning,
    civilConstraints,
    permitsStatic,
    pricingVerification,
    fusionDemand,
    competitivePressure,
    feasibility,
    reverseFeasibility,
    momentumReader,
    verdict,
    vaultMapper,
    finalVerdict: verdict.verdict,
    verdictScore: verdict.score,
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
      pass1_id,
      pass15_id,
      zip,
      state,
      parcel_id,
      address,
      latitude,
      longitude,
      acreage,
    } = await req.json();

    if (!pass1_id || !zip || !state) {
      return new Response(
        JSON.stringify({ error: 'pass1_id, zip, and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass2] Starting underwriting for pass1_id: ${pass1_id}, ZIP: ${zip}`);

    // =========================================================================
    // STEP 1: Run Pass-2 Orchestrator
    // =========================================================================
    const pass2Input: Pass2Input = {
      pass1RunId: pass1_id,
      pass15RunId: pass15_id,
      targetZip: zip,
      targetState: state,
      parcelId: parcel_id,
      address,
      latitude,
      longitude,
      acreage,
    };

    const pass2Output = await runPass2Orchestrator(pass2Input);

    // =========================================================================
    // STEP 2: Store Pass-2 Results
    // =========================================================================
    const { data: pass2Run, error: insertError } = await supabase
      .from('pass2_runs')
      .insert({
        pass1_id,
        pass15_id: pass15_id || null,
        zip,
        state,
        run_id: pass2Output.runId,
        results: pass2Output,
        final_verdict: pass2Output.finalVerdict,
        verdict_score: pass2Output.verdictScore,
        status: pass2Output.status,
        // Map to OpportunityObject segments
        zoning: pass2Output.zoning,
        feasibility: pass2Output.feasibility,
        reverse_feasibility: pass2Output.reverseFeasibility,
        fusion_demand: pass2Output.fusionDemand,
        verdict: pass2Output.verdict,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass2] Insert error:', insertError);
      throw insertError;
    }

    // =========================================================================
    // STEP 3: Log Engine Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'start_pass2',
      event: 'underwriting_complete',
      payload: {
        pass2_id: pass2Run.id,
        pass1_id,
        run_id: pass2Output.runId,
        zip,
        state,
        final_verdict: pass2Output.finalVerdict,
        verdict_score: pass2Output.verdictScore,
      },
      status: pass2Output.status,
    });

    console.log(`[start_pass2] Completed with verdict: ${pass2Output.finalVerdict} (score: ${pass2Output.verdictScore})`);

    // =========================================================================
    // STEP 4: Return Response
    // =========================================================================
    return new Response(
      JSON.stringify({
        pass2_id: pass2Run.id,
        run_id: pass2Output.runId,
        status: pass2Output.status,
        final_verdict: pass2Output.finalVerdict,
        verdict_score: pass2Output.verdictScore,
        results: pass2Output,
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
