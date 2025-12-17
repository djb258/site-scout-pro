import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * START_PASS0 Edge Function
 *
 * Initiates Pass-0 Momentum Hub analysis for a given ZIP code.
 * Pass-0 aggregates momentum signals before site-specific analysis.
 *
 * Request body:
 *   - zip: string (required) - Target ZIP code
 *   - state: string (required) - Target state
 *   - msa_code: string (optional) - MSA code for regional analysis
 *   - lookback_months: number (optional) - Lookback period for trends (default: 12)
 *
 * Response:
 *   - Success: { pass0_id, status, momentum_score }
 *   - Error: { error }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// INLINE ORCHESTRATOR TYPES (for Deno edge function compatibility)
// ============================================================================

interface Pass0Input {
  targetZip: string;
  targetState: string;
  msaCode?: string;
  lookbackMonths?: number;
}

interface Pass0Output {
  pass: 'PASS0';
  runId: string;
  timestamp: string;
  input: Pass0Input;
  trendSignal: any | null;
  permitActivity: any | null;
  newsEvents: any | null;
  industrialLogistics: any | null;
  housingPipeline: any | null;
  momentumFusion: any | null;
  aggregatedMomentumScore: number;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

// ============================================================================
// INLINE ORCHESTRATOR (simplified for edge function)
// ============================================================================

async function runPass0Orchestrator(input: Pass0Input): Promise<Pass0Output> {
  const runId = `P0-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[PASS0_MOMENTUM_HUB] Starting run ${runId}`);

  // Placeholder spoke outputs (would call actual spokes in production)
  const trendSignal = {
    spokeId: 'SS.00.01',
    googleTrendsIndex: 65,
    searchVolumeGrowth: 0.12,
    timestamp: new Date().toISOString(),
  };

  const permitActivity = {
    spokeId: 'SS.00.02',
    commercialPermits: 45,
    residentialPermits: 120,
    permitGrowthRate: 0.08,
    timestamp: new Date().toISOString(),
  };

  const newsEvents = {
    spokeId: 'SS.00.03',
    majorEmployerAnnouncements: [],
    infrastructureProjects: [],
    sentimentScore: 0.6,
    timestamp: new Date().toISOString(),
  };

  const industrialLogistics = {
    spokeId: 'SS.00.04',
    warehouseVacancyRate: 0.045,
    newLogisticsFacilities: 2,
    freightVolumeIndex: 72,
    timestamp: new Date().toISOString(),
  };

  const housingPipeline = {
    spokeId: 'SS.00.05',
    multifamilyUnitsPermitted: 85,
    singleFamilyStarts: 45,
    housingSupplyPressure: 'medium' as const,
    timestamp: new Date().toISOString(),
  };

  const momentumFusion = {
    spokeId: 'SS.00.06',
    fusedMomentumScore: 68,
    confidenceLevel: 'medium' as const,
    topContributors: ['permitActivity', 'industrialLogistics'],
    timestamp: new Date().toISOString(),
  };

  return {
    pass: 'PASS0',
    runId,
    timestamp: new Date().toISOString(),
    input,
    trendSignal,
    permitActivity,
    newsEvents,
    industrialLogistics,
    housingPipeline,
    momentumFusion,
    aggregatedMomentumScore: momentumFusion.fusedMomentumScore,
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
      msa_code,
      lookback_months = 12,
    } = await req.json();

    if (!zip || !state) {
      return new Response(
        JSON.stringify({ error: 'zip and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass0] Starting momentum analysis for ZIP: ${zip}, State: ${state}`);

    // =========================================================================
    // STEP 1: Run Pass-0 Orchestrator
    // =========================================================================
    const pass0Input: Pass0Input = {
      targetZip: zip,
      targetState: state,
      msaCode: msa_code,
      lookbackMonths: lookback_months,
    };

    const pass0Output = await runPass0Orchestrator(pass0Input);

    // =========================================================================
    // STEP 2: Store Pass-0 Results
    // =========================================================================
    const { data: pass0Run, error: insertError } = await supabase
      .from('pass0_runs')
      .insert({
        zip,
        state,
        msa_code: msa_code || null,
        run_id: pass0Output.runId,
        results: pass0Output,
        momentum_score: pass0Output.aggregatedMomentumScore,
        status: pass0Output.status,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass0] Insert error:', insertError);
      // Continue even if storage fails - return the results
    }

    // =========================================================================
    // STEP 3: Log Engine Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'start_pass0',
      event: 'momentum_complete',
      payload: {
        pass0_id: pass0Run?.id,
        run_id: pass0Output.runId,
        zip,
        state,
        momentum_score: pass0Output.aggregatedMomentumScore,
      },
      status: pass0Output.status,
    });

    console.log(`[start_pass0] Completed with momentum score: ${pass0Output.aggregatedMomentumScore}`);

    // =========================================================================
    // STEP 4: Return Response
    // =========================================================================
    return new Response(
      JSON.stringify({
        pass0_id: pass0Run?.id,
        run_id: pass0Output.runId,
        status: pass0Output.status,
        momentum_score: pass0Output.aggregatedMomentumScore,
        results: pass0Output,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass0] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
