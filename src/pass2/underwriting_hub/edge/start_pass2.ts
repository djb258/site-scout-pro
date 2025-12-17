/**
 * EDGE FUNCTION: start_pass2
 *
 * Lovable.dev compatible edge function for Pass 2 analysis
 * Includes DRY_RUN mode for testing
 *
 * Request:
 *   POST /start_pass2
 *   {
 *     run_id: string,
 *     acreage?: number (default 3),
 *     land_cost_per_acre?: number (default 150000),
 *     force_run?: boolean (skip prerequisite check)
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     status: 'pass2_complete',
 *     opportunity: OpportunityObject,
 *     verdict: FinalVerdict
 *   }
 *
 * DRY_RUN mode:
 *   Set DRY_RUN=true in environment to test with dummy data
 */

// Static imports only - no dynamic imports allowed in Cloudflare Workers
import type { OpportunityObject, FinalVerdict, AnalysisToggles } from '../shared/OpportunityObject';
import { createEmptyOpportunityObject } from '../shared/OpportunityObject';
import { runPass2, runPass2Shell } from '../pass2_hub/orchestrator/Pass2Orchestrator';
import type { Pass2Output as TypedPass2Output, VerdictResult } from '../pass2_hub/types/pass2_types';
import {
  createRun,
  updateRunStatus,
  getStagedOpportunity,
  stageOpportunity,
  stageResults,
  writeLog,
  writeErrorLog,
  createResponse,
  ensureSerializable,
  TABLES,
} from '../shared/adapters/LovableAdapter';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface StartPass2Request {
  run_id: string;
  acreage?: number;
  land_cost_per_acre?: number;
  force_run?: boolean;
}

export interface StartPass2Response {
  success: boolean;
  mode?: 'normal' | 'dry-run' | 'shell';
  run_id?: string;
  status?: string;
  opportunity?: OpportunityObject;
  verdict?: FinalVerdict | VerdictResult;
  pass2Results?: TypedPass2Output;
  prerequisite_failures?: string[];
  error?: string;
  timestamp: number;
}

// ============================================================================
// DRY RUN TEST DATA
// ============================================================================

/**
 * Create dummy opportunity object for dry-run testing
 */
function createDryRunOpportunity(): OpportunityObject {
  const toggles: AnalysisToggles = {
    urban_exclude: false,
    multifamily_priority: true,
    recreation_load: false,
    industrial_momentum: true,
    analysis_mode: 'build',
  };

  const opportunity = createEmptyOpportunityObject('99999', toggles);

  // Populate with test data
  opportunity.identity = {
    zip: '99999',
    city: 'Test City',
    county: 'Test County',
    state: 'XX',
    state_id: 'XX',
    lat: 39.0,
    lng: -77.0,
    county_fips: '99999',
  };

  opportunity.pass1_macro = {
    zip_metadata: {
      zip: '99999',
      city: 'Test City',
      county: 'Test County',
      state_id: 'XX',
      state_name: 'Test State',
      lat: 39.0,
      lng: -77.0,
      population: 50000,
      density: 1500,
      income_household_median: 75000,
      home_value: 350000,
      home_ownership: 0.65,
      rent_median: 1200,
      age_median: 38,
    },
    radius_counties: [
      { county: 'Test County', state: 'XX', population: 50000 },
      { county: 'Adjacent County', state: 'XX', population: 75000 },
    ],
    competitors: [
      { name: 'Test Storage A', distance_miles: 3.5, estimated_sqft: 50000 },
      { name: 'Test Storage B', distance_miles: 5.2, estimated_sqft: 35000 },
    ],
    housing_signals: {
      median_home_value: 350000,
      home_ownership_rate: 0.65,
      rent_median: 1200,
      growth_indicator: 'high',
    },
    anchors: [
      { type: 'retail', name: 'Test Mall', distance_miles: 2.5 },
    ],
    rv_lake_signals: {
      recreation_load: false,
      rv_potential: 'low',
      lake_proximity: false,
      campground_nearby: false,
    },
    industrial_signals: {
      industrial_momentum: true,
      distribution_centers_nearby: 3,
      manufacturing_presence: 'moderate',
    },
    macro_demand: {
      population: 50000,
      demand_sqft: 300000,
      household_count: 20000,
      demand_per_household: 15,
    },
    macro_supply: {
      competitor_count: 2,
      total_supply_sqft: 85000,
      avg_distance_miles: 4.35,
      density_score: 35,
    },
    hotspot_score: {
      overall_score: 72,
      population_factor: 75,
      competition_factor: 65,
      industrial_factor: 70,
      multifamily_factor: 60,
      recreation_factor: 20,
      tier: 'B',
    },
  };

  opportunity.pass1_recommendation = {
    viability_score: 72,
    tier: 'B',
    recommendation: 'Moderate potential - Pass 2 recommended for validation',
    key_factors: ['Strong population base', 'Industrial presence'],
    risk_factors: ['Moderate competition'],
    proceed_to_pass2: true,
  };

  opportunity.local_scan = {
    config: {
      radius_miles: 10,
      include_pricing: true,
      generate_call_sheet: true,
    },
    local_competitors: [
      {
        name: 'Test Storage A',
        distance_miles: 3.5,
        estimated_sqft: 50000,
        pricing_verified: true,
        rates: { '10x10': 125, '10x20': 175 },
      },
    ],
    call_sheet: [],
    pricing_readiness: {
      total_facilities: 2,
      pricing_verified: 1,
      pricing_needed: 1,
      readiness_pct: 50,
    },
  };

  opportunity.ai_caller_pricing = [
    {
      facility_id: 'test-1',
      facility_name: 'Test Storage A',
      call_date: new Date().toISOString(),
      rates_collected: [
        { unit_size: '10x10', sqft: 100, climate_control: false, advertised_rate: 125 },
        { unit_size: '10x20', sqft: 200, climate_control: false, advertised_rate: 175 },
      ],
      availability: [
        { unit_size: '10x10', available: true },
      ],
      confidence_level: 'high',
    },
  ];

  opportunity.pass2_ready = true;
  opportunity.pass2_prerequisites = {
    has_pricing_data: true,
    has_competitor_list: true,
    has_zoning_lookup: true,
  };
  opportunity.status = 'local_scan_complete';

  return opportunity;
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

/**
 * Main handler for start_pass2 edge function
 * Compatible with Lovable.dev / Cloudflare Workers
 */
export default async function handler(req: Request): Promise<Response> {
  try {
    // Check for DRY_RUN mode
    // In Cloudflare Workers, use env binding or query param
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dry_run') === 'true';

    if (isDryRun) {
      return handleDryRun();
    }

    // Parse request body
    const body = (await req.json()) as StartPass2Request;

    // Validate required fields
    if (!body.run_id) {
      return Response.json(
        createResponse(false, undefined, 'run_id is required'),
        { status: 400 }
      );
    }

    const acreage = body.acreage ?? 3;
    const landCostPerAcre = body.land_cost_per_acre ?? 150000;
    const forceRun = body.force_run ?? false;

    // Log incoming request
    await writeLog('pass2_started', {
      run_id: body.run_id,
      acreage,
      land_cost_per_acre: landCostPerAcre,
      force_run: forceRun,
    });

    // Get staged opportunity from DB
    const opportunity = await getStagedOpportunity<OpportunityObject>(body.run_id);

    if (!opportunity) {
      return Response.json(
        createResponse(false, undefined, 'Opportunity not found. Run Pass 1 first.'),
        { status: 404 }
      );
    }

    // Check prerequisites unless force_run
    if (!forceRun) {
      const prerequisiteFailures: string[] = [];

      if (opportunity.status !== 'pass1_complete' && opportunity.status !== 'local_scan_complete') {
        prerequisiteFailures.push('Pass 1 not complete');
      }

      if (!opportunity.pass2_prerequisites.has_pricing_data) {
        prerequisiteFailures.push('Pricing data not available');
      }

      if (!opportunity.pass2_prerequisites.has_competitor_list) {
        prerequisiteFailures.push('Competitor list not populated');
      }

      if (prerequisiteFailures.length > 0) {
        return Response.json({
          success: false,
          error: 'Prerequisites not met for Pass 2',
          prerequisite_failures: prerequisiteFailures,
          timestamp: Date.now(),
        } as StartPass2Response);
      }
    }

    // Create Pass 2 run record
    const { id: pass2RunId } = await createRun(TABLES.PASS2_RUNS, opportunity.identity.zip, {
      pass1_run_id: body.run_id,
      acreage,
      land_cost_per_acre: landCostPerAcre,
    });

    // Update status to running
    await updateRunStatus(TABLES.PASS2_RUNS, pass2RunId, 'running');

    // Run Pass 2 orchestrator
    const result = await runPass2({
      opportunity,
      acreage,
      land_cost_per_acre: landCostPerAcre,
    });

    if (!result.success || !result.opportunity) {
      // Update run status to failed
      await updateRunStatus(TABLES.PASS2_RUNS, pass2RunId, 'failed', {
        error: result.error,
      });

      await writeErrorLog('pass2_failed', result.error || 'Unknown error', {
        run_id: body.run_id,
        pass2_run_id: pass2RunId,
      });

      return Response.json(
        createResponse(false, undefined, result.error || 'Pass 2 failed'),
        { status: 500 }
      );
    }

    // Stage updated opportunity back to DB
    await stageOpportunity(body.run_id, result.opportunity);

    // Stage Pass 2 results separately
    await stageResults(body.run_id, 'pass2', result.opportunity.pass2_results);

    // Update run status to complete
    await updateRunStatus(TABLES.PASS2_RUNS, pass2RunId, 'complete', {
      verdict: result.opportunity.final_verdict?.decision,
      confidence: result.opportunity.final_verdict?.confidence,
      is_viable: result.opportunity.pass2_results?.feasibility.is_viable,
    });

    // Log completion
    await writeLog('pass2_complete', {
      run_id: body.run_id,
      pass2_run_id: pass2RunId,
      verdict: result.opportunity.final_verdict?.decision,
      confidence: result.opportunity.final_verdict?.confidence,
    });

    // Build JSON-serializable response
    const response: StartPass2Response = {
      success: true,
      mode: 'normal',
      run_id: body.run_id,
      status: 'pass2_complete',
      opportunity: ensureSerializable(result.opportunity),
      verdict: result.opportunity.final_verdict,
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass2_exception', error instanceof Error ? error : errorMessage);

    return Response.json(
      createResponse(false, undefined, errorMessage),
      { status: 500 }
    );
  }
}

// ============================================================================
// DRY RUN HANDLER
// ============================================================================

/**
 * Handle dry-run mode for testing Pass 2
 * Uses new shell orchestrator for typed results
 */
async function handleDryRun(): Promise<Response> {
  await writeLog('pass2_dry_run_started', {
    timestamp: Date.now(),
  });

  try {
    // Create dummy opportunity
    const testOpportunity = createDryRunOpportunity();

    // Run Pass 2 Shell with test data (new typed interface)
    const shellResult = await runPass2Shell({
      opportunity: testOpportunity,
      acreage: 3,
      land_cost_per_acre: 150000,
    });

    await writeLog('pass2_dry_run_complete', {
      success: shellResult.success,
      verdict: shellResult.verdict.decision,
      zoningStatus: shellResult.zoning.status,
      feasibilityViable: shellResult.feasibility.isViable,
    });

    const response: StartPass2Response = {
      success: shellResult.success,
      mode: 'dry-run',
      run_id: shellResult.runId,
      status: shellResult.success ? 'pass2_complete' : 'failed',
      verdict: shellResult.verdict,
      pass2Results: ensureSerializable(shellResult),
      error: shellResult.error,
      timestamp: shellResult.timestamp,
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass2_dry_run_exception', error instanceof Error ? error : errorMessage);

    return Response.json({
      success: false,
      mode: 'dry-run',
      error: errorMessage,
      timestamp: Date.now(),
    } as StartPass2Response);
  }
}

// ============================================================================
// PREREQUISITE CHECK HELPER
// ============================================================================

/**
 * Check if opportunity is ready for Pass 2
 */
export function checkPass2Readiness(opportunity: OpportunityObject): {
  ready: boolean;
  missing: string[];
  recommendations: string[];
} {
  const missing: string[] = [];
  const recommendations: string[] = [];

  // Check status
  if (opportunity.status !== 'pass1_complete' && opportunity.status !== 'local_scan_complete') {
    missing.push('Pass 1 not complete');
    recommendations.push('Run Pass 1 analysis first');
  }

  // Check pricing data
  if (!opportunity.pass2_prerequisites.has_pricing_data) {
    missing.push('Pricing data');

    if (opportunity.local_scan?.call_sheet) {
      const pendingCalls = opportunity.local_scan.call_sheet.filter(
        (c) => c.call_status === 'pending'
      ).length;

      if (pendingCalls > 0) {
        recommendations.push(`Trigger AI dialer for ${pendingCalls} pending calls`);
      } else {
        recommendations.push('Enter pricing data manually or re-generate call sheet');
      }
    } else {
      recommendations.push('Run local scan to generate call sheet');
    }
  }

  // Check competitor list
  if (!opportunity.pass2_prerequisites.has_competitor_list) {
    missing.push('Competitor list');
    recommendations.push('Run local scan to populate competitors');
  }

  return {
    ready: missing.length === 0,
    missing,
    recommendations,
  };
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleStartPass2 };
