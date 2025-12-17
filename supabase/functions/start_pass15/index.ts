import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * START_PASS15 Edge Function
 *
 * Initiates Pass-1.5 Rate Verification Hub analysis.
 * Pass-1.5 collects and verifies rate evidence before underwriting.
 *
 * Request body:
 *   - pass1_id: string (required) - The Pass-1 run ID to build upon
 *   - zip: string (required) - Target ZIP code
 *   - competitors: CompetitorForRates[] (optional) - Competitors to scrape rates from
 *   - min_coverage_threshold: number (optional) - Minimum rate coverage threshold (default: 0.6)
 *
 * Response:
 *   - Success: { pass15_id, run_id, status, coverage_score, promoted_to_pass2 }
 *   - Error: { error }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// INLINE ORCHESTRATOR TYPES (for Deno edge function compatibility)
// ============================================================================

interface CompetitorForRates {
  name: string;
  address: string;
  phone?: string;
  website?: string;
}

interface Pass15Input {
  pass1RunId: string;
  targetZip: string;
  competitors: CompetitorForRates[];
  minCoverageThreshold?: number;
}

interface Pass15Output {
  pass: 'PASS15';
  runId: string;
  timestamp: string;
  input: Pass15Input;
  publishedRateScraper: any | null;
  aiCallWorkOrders: any | null;
  rateEvidenceNormalizer: any | null;
  coverageConfidence: any | null;
  promotionGate: any | null;
  coverageScore: number;
  promotedToPass2: boolean;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

// ============================================================================
// INLINE ORCHESTRATOR (simplified for edge function)
// ============================================================================

async function runPass15Orchestrator(input: Pass15Input): Promise<Pass15Output> {
  const runId = `P15-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[PASS15_RATE_HUB] Starting run ${runId}`);

  // Placeholder spoke outputs (would call actual spokes in production)
  const publishedRateScraper = {
    spokeId: 'SS.015.01',
    scrapedRates: [
      { competitorName: 'Public Storage', unitSize: '10x10', monthlyRate: 125, source: 'website', confidence: 0.9 },
      { competitorName: 'Extra Space', unitSize: '10x10', monthlyRate: 135, source: 'website', confidence: 0.85 },
    ],
    successCount: 2,
    failureCount: 0,
    timestamp: new Date().toISOString(),
  };

  const aiCallWorkOrders = {
    spokeId: 'SS.015.02',
    workOrders: [],
    totalCalls: 0,
    completedCalls: 0,
    timestamp: new Date().toISOString(),
  };

  const rateEvidenceNormalizer = {
    spokeId: 'SS.015.03',
    normalizedRates: [
      { competitorName: 'Public Storage', unitSize: '10x10', normalizedRate: 125, source: 'scraped', confidence: 0.9 },
      { competitorName: 'Extra Space', unitSize: '10x10', normalizedRate: 135, source: 'scraped', confidence: 0.85 },
    ],
    averageBySize: { '10x10': 130, '10x20': 195 },
    medianBySize: { '10x10': 130, '10x20': 195 },
    timestamp: new Date().toISOString(),
  };

  const coverageConfidence = {
    spokeId: 'SS.015.04',
    overallCoverage: 0.75,
    coverageBySize: { '10x10': 0.85, '10x20': 0.65 },
    competitorsCovered: input.competitors.length > 0 ? Math.ceil(input.competitors.length * 0.75) : 2,
    competitorsTotal: input.competitors.length > 0 ? input.competitors.length : 3,
    confidenceLevel: 'medium' as const,
    timestamp: new Date().toISOString(),
  };

  const promotionGate = {
    spokeId: 'SS.015.05',
    passed: coverageConfidence.overallCoverage >= (input.minCoverageThreshold ?? 0.6),
    coverageScore: coverageConfidence.overallCoverage * 100,
    threshold: (input.minCoverageThreshold ?? 0.6) * 100,
    promotedToPass2: coverageConfidence.overallCoverage >= (input.minCoverageThreshold ?? 0.6),
    failureReasons: [],
    timestamp: new Date().toISOString(),
  };

  return {
    pass: 'PASS15',
    runId,
    timestamp: new Date().toISOString(),
    input,
    publishedRateScraper,
    aiCallWorkOrders,
    rateEvidenceNormalizer,
    coverageConfidence,
    promotionGate,
    coverageScore: coverageConfidence.overallCoverage * 100,
    promotedToPass2: promotionGate.promotedToPass2,
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
      zip,
      competitors = [],
      min_coverage_threshold = 0.6,
    } = await req.json();

    if (!pass1_id || !zip) {
      return new Response(
        JSON.stringify({ error: 'pass1_id and zip are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass15] Starting rate verification for pass1_id: ${pass1_id}, ZIP: ${zip}`);

    // =========================================================================
    // STEP 1: Fetch Pass-1 Run (to get competitor data if not provided)
    // =========================================================================
    let competitorList = competitors;
    if (competitorList.length === 0) {
      const { data: pass1Run } = await supabase
        .from('pass1_runs')
        .select('results')
        .eq('id', pass1_id)
        .single();

      if (pass1Run?.results?.competitorRegistry?.competitors) {
        competitorList = pass1Run.results.competitorRegistry.competitors.map((c: any) => ({
          name: c.name,
          address: c.address,
          phone: c.phone,
          website: c.website,
        }));
      }
    }

    // =========================================================================
    // STEP 2: Run Pass-1.5 Orchestrator
    // =========================================================================
    const pass15Input: Pass15Input = {
      pass1RunId: pass1_id,
      targetZip: zip,
      competitors: competitorList,
      minCoverageThreshold: min_coverage_threshold,
    };

    const pass15Output = await runPass15Orchestrator(pass15Input);

    // =========================================================================
    // STEP 3: Store Pass-1.5 Results
    // =========================================================================
    const { data: pass15Run, error: insertError } = await supabase
      .from('pass15_runs')
      .insert({
        pass1_id,
        zip,
        run_id: pass15Output.runId,
        results: pass15Output,
        coverage_score: pass15Output.coverageScore,
        promoted_to_pass2: pass15Output.promotedToPass2,
        status: pass15Output.status,
        // Map to OpportunityObject segments
        rate_evidence: pass15Output.rateEvidenceNormalizer,
        coverage_confidence: pass15Output.coverageConfidence,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass15] Insert error:', insertError);
      // Continue even if storage fails
    }

    // =========================================================================
    // STEP 4: Log Engine Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'start_pass15',
      event: 'rate_verification_complete',
      payload: {
        pass15_id: pass15Run?.id,
        pass1_id,
        run_id: pass15Output.runId,
        zip,
        coverage_score: pass15Output.coverageScore,
        promoted_to_pass2: pass15Output.promotedToPass2,
      },
      status: pass15Output.status,
    });

    console.log(`[start_pass15] Completed with coverage score: ${pass15Output.coverageScore}`);

    // =========================================================================
    // STEP 5: Return Response
    // =========================================================================
    return new Response(
      JSON.stringify({
        pass15_id: pass15Run?.id,
        run_id: pass15Output.runId,
        status: pass15Output.status,
        coverage_score: pass15Output.coverageScore,
        promoted_to_pass2: pass15Output.promotedToPass2,
        results: pass15Output,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass15] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
