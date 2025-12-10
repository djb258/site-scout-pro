/**
 * EDGE FUNCTION: start_pass1
 *
 * Lovable.dev compatible edge function for Pass 1 analysis
 * Includes DRY_RUN mode for testing
 *
 * Request:
 *   POST /start_pass1
 *   {
 *     zip_code: string,
 *     urban_exclude?: boolean,
 *     multifamily_priority?: boolean,
 *     recreation_load?: boolean,
 *     industrial_momentum?: boolean,
 *     analysis_mode?: 'build' | 'buy' | 'compare',
 *     run_local_scan?: boolean,
 *     local_scan_radius?: number
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     run_id: string,
 *     status: 'pass1_complete',
 *     opportunity: OpportunityObject,
 *     summary: Pass1Recommendation,
 *     hotspots?: CountyHotspot[]
 *   }
 *
 * DRY_RUN mode:
 *   GET /start_pass1?dry_run=true to test with dummy data
 */

// Static imports only - no dynamic imports allowed in Cloudflare Workers
import type { AnalysisToggles, OpportunityObject } from '../shared/OpportunityObject';
import { createEmptyOpportunityObject } from '../shared/OpportunityObject';
import { runPass1 } from '../pass1_hub/orchestrator/Pass1Orchestrator';
import type { CountyHotspot } from '../pass1_hub/spokes/HotspotScoring';
import {
  createRun,
  updateRunStatus,
  stageOpportunity,
  writeLog,
  writeErrorLog,
  createResponse,
  ensureSerializable,
  TABLES,
} from '../shared/adapters/LovableAdapter';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface StartPass1Request {
  zip_code: string;
  urban_exclude?: boolean;
  multifamily_priority?: boolean;
  recreation_load?: boolean;
  industrial_momentum?: boolean;
  analysis_mode?: 'build' | 'buy' | 'compare';
  run_local_scan?: boolean;
  local_scan_radius?: number;
}

export interface StartPass1Response {
  success: boolean;
  mode?: 'normal' | 'dry-run';
  run_id?: string;
  status?: string;
  opportunity?: OpportunityObject;
  summary?: {
    zip: string;
    city: string;
    county: string;
    state: string;
    population: number;
    demand_sqft: number;
    competitor_count: number;
    supply_sqft: number;
    hotspot_count: number;
    county_count: number;
    viability_score: number;
    tier: string;
    recommendation: string;
    key_factors: string[];
    risk_factors: string[];
    proceed_to_pass2: boolean;
    // NEW: Enrichment summary
    reit_presence: boolean;
    grade_a_competitors: number;
    competition_pressure: number;
    // NEW: Validation summary
    validation_score: number;
    completion_pct: number;
  };
  hotspots?: CountyHotspot[];
  validation?: {
    is_valid: boolean;
    validation_score: number;
    pass2_ready: boolean;
    blockers: string[];
    warnings: string[];
  };
  error?: string;
  timestamp: number;
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

/**
 * Main handler for start_pass1 edge function
 * Compatible with Lovable.dev / Cloudflare Workers
 */
export default async function handler(req: Request): Promise<Response> {
  try {
    // Check for DRY_RUN mode
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dry_run') === 'true';

    if (isDryRun) {
      return handleDryRun();
    }

    // Parse request body
    const body = (await req.json()) as StartPass1Request;

    // Validate required fields
    if (!body.zip_code) {
      return Response.json(
        createResponse(false, undefined, 'zip_code is required'),
        { status: 400 }
      );
    }

    // Log incoming request
    await writeLog('pass1_started', {
      zip_code: body.zip_code,
      toggles: {
        urban_exclude: body.urban_exclude,
        multifamily_priority: body.multifamily_priority,
        recreation_load: body.recreation_load,
        industrial_momentum: body.industrial_momentum,
        analysis_mode: body.analysis_mode,
      },
    });

    // Create run record in scratchpad
    const { id: runId } = await createRun(TABLES.PASS1_RUNS, body.zip_code, {
      toggles: {
        urban_exclude: body.urban_exclude ?? false,
        multifamily_priority: body.multifamily_priority ?? false,
        recreation_load: body.recreation_load ?? false,
        industrial_momentum: body.industrial_momentum ?? false,
        analysis_mode: body.analysis_mode ?? 'build',
      },
      run_local_scan: body.run_local_scan ?? false,
      local_scan_radius: body.local_scan_radius,
    });

    // Update status to running
    await updateRunStatus(TABLES.PASS1_RUNS, runId, 'running');

    // Build toggles from request
    const toggles: AnalysisToggles = {
      urban_exclude: body.urban_exclude ?? false,
      multifamily_priority: body.multifamily_priority ?? false,
      recreation_load: body.recreation_load ?? false,
      industrial_momentum: body.industrial_momentum ?? false,
      analysis_mode: body.analysis_mode ?? 'build',
    };

    // Run Pass 1 orchestrator
    const result = await runPass1({
      zip_code: body.zip_code,
      toggles,
      run_local_scan: body.run_local_scan,
      local_scan_radius: body.local_scan_radius,
    });

    if (!result.success || !result.opportunity) {
      // Update run status to failed
      await updateRunStatus(TABLES.PASS1_RUNS, runId, 'failed', {
        error: result.error,
      });

      await writeErrorLog('pass1_failed', result.error || 'Unknown error', {
        run_id: runId,
        zip_code: body.zip_code,
      });

      return Response.json(
        createResponse(false, undefined, result.error || 'Pass 1 failed'),
        { status: 500 }
      );
    }

    // Stage opportunity object in scratchpad DB
    await stageOpportunity(runId, result.opportunity);

    // Update run status to complete
    await updateRunStatus(TABLES.PASS1_RUNS, runId, 'complete', {
      opportunity_id: result.opportunity.id,
      viability_score: result.opportunity.pass1_recommendation.viability_score,
      tier: result.opportunity.pass1_recommendation.tier,
      proceed_to_pass2: result.opportunity.pass1_recommendation.proceed_to_pass2,
    });

    // Log completion
    await writeLog('pass1_complete', {
      run_id: runId,
      opportunity_id: result.opportunity.id,
      tier: result.opportunity.pass1_recommendation.tier,
      score: result.opportunity.pass1_recommendation.viability_score,
    });

    // Build JSON-serializable response
    const enrichment = result.opportunity.pass1_macro.competitor_enrichment;
    const validation = result.validation;

    const response: StartPass1Response = {
      success: true,
      mode: 'normal',
      run_id: runId,
      status: 'pass1_complete',
      opportunity: ensureSerializable(result.opportunity),
      summary: {
        zip: result.opportunity.identity.zip,
        city: result.opportunity.identity.city,
        county: result.opportunity.identity.county,
        state: result.opportunity.identity.state_id,
        population: result.opportunity.pass1_macro.macro_demand?.population || 0,
        demand_sqft: result.opportunity.pass1_macro.macro_demand?.demand_sqft || 0,
        competitor_count: result.opportunity.pass1_macro.macro_supply?.competitor_count || 0,
        supply_sqft: result.opportunity.pass1_macro.macro_supply?.total_supply_sqft || 0,
        hotspot_count: result.hotspots?.filter(h => h.is_hotspot).length || 0,
        county_count: result.opportunity.pass1_macro.radius_counties?.length || 0,
        viability_score: result.opportunity.pass1_recommendation.viability_score,
        tier: result.opportunity.pass1_recommendation.tier,
        recommendation: result.opportunity.pass1_recommendation.recommendation,
        key_factors: result.opportunity.pass1_recommendation.key_factors,
        risk_factors: result.opportunity.pass1_recommendation.risk_factors,
        proceed_to_pass2: result.opportunity.pass1_recommendation.proceed_to_pass2,
        // NEW: Enrichment summary
        reit_presence: enrichment?.reit_presence || false,
        grade_a_competitors: enrichment?.grade_a_count || 0,
        competition_pressure: result.summary?.competition_pressure || 0,
        // NEW: Validation summary
        validation_score: validation?.validation_score || 0,
        completion_pct: result.summary?.completion_pct || 0,
      },
      hotspots: result.hotspots ? ensureSerializable(result.hotspots) : undefined,
      validation: validation ? {
        is_valid: validation.is_valid,
        validation_score: validation.validation_score,
        pass2_ready: validation.pass2_ready,
        blockers: validation.blockers,
        warnings: validation.warnings,
      } : undefined,
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass1_exception', error instanceof Error ? error : errorMessage);

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

  const opportunity = createEmptyOpportunityObject('22101', toggles);

  // Populate with test data (McLean, VA area)
  opportunity.identity = {
    zip: '22101',
    city: 'McLean',
    county: 'Fairfax County',
    state: 'VA',
    state_id: 'VA',
    lat: 38.9339,
    lng: -77.1773,
    county_fips: '51059',
  };

  opportunity.pass1_macro = {
    zip_metadata: {
      zip: '22101',
      city: 'McLean',
      county: 'Fairfax County',
      state_id: 'VA',
      state_name: 'Virginia',
      lat: 38.9339,
      lng: -77.1773,
      population: 48115,
      density: 2100,
      income_household_median: 185000,
      home_value: 950000,
      home_ownership: 0.78,
      rent_median: 2200,
      age_median: 42,
    },
    radius_counties: [
      { county: 'Fairfax County', state: 'VA', population: 1150000, distance_miles: 0 },
      { county: 'Arlington County', state: 'VA', population: 238000, distance_miles: 8 },
      { county: 'Loudoun County', state: 'VA', population: 420000, distance_miles: 15 },
      { county: 'Montgomery County', state: 'MD', population: 1050000, distance_miles: 12 },
      { county: 'Prince William County', state: 'VA', population: 482000, distance_miles: 25 },
    ],
    competitors: [
      { name: 'Extra Space Storage', distance_miles: 2.1, estimated_sqft: 65000 },
      { name: 'Public Storage', distance_miles: 3.4, estimated_sqft: 48000 },
      { name: 'CubeSmart', distance_miles: 4.8, estimated_sqft: 52000 },
    ],
    housing_signals: {
      median_home_value: 950000,
      home_ownership_rate: 0.78,
      rent_median: 2200,
      growth_indicator: 'high',
    },
    anchors: [
      { type: 'retail', name: 'Tysons Corner Center', distance_miles: 2.5 },
      { type: 'employer', name: 'Capital One HQ', distance_miles: 3.1 },
    ],
    rv_lake_signals: {
      recreation_load: false,
      rv_potential: 'low',
      lake_proximity: false,
      campground_nearby: false,
    },
    industrial_signals: {
      industrial_momentum: true,
      distribution_centers_nearby: 4,
      manufacturing_presence: 'moderate',
    },
    macro_demand: {
      population: 48115,
      demand_sqft: 288690, // 48115 × 6
      household_count: 18500,
      demand_per_household: 15.6,
    },
    macro_supply: {
      competitor_count: 3,
      total_supply_sqft: 165000,
      avg_distance_miles: 3.43,
      density_score: 42, // Moderate competition
    },
    hotspot_score: {
      overall_score: 68,
      population_factor: 70,
      competition_factor: 58,
      industrial_factor: 65,
      multifamily_factor: 45,
      recreation_factor: 15,
      tier: 'B',
    },
  };

  opportunity.pass1_recommendation = {
    viability_score: 68,
    tier: 'B',
    recommendation: 'Moderate potential - Pass 2 recommended for validation',
    key_factors: ['Strong population base', 'Industrial presence', 'High income area'],
    risk_factors: ['High land costs', 'Established competition'],
    proceed_to_pass2: true,
  };

  opportunity.pass2_ready = true;
  opportunity.pass2_prerequisites = {
    has_pricing_data: false,
    has_competitor_list: true,
    has_zoning_lookup: false,
  };
  opportunity.status = 'pass1_complete';
  opportunity.pass1_completed_at = new Date().toISOString();

  return opportunity;
}

/**
 * Create dummy hotspots for dry-run testing
 */
function createDryRunHotspots(): CountyHotspot[] {
  return [
    {
      county: 'Loudoun County',
      state: 'VA',
      population: 420000,
      demand_sqft: 2520000, // 420K × 6
      estimated_supply_sqft: 1800000,
      supply_gap_sqft: 720000,
      supply_ratio: 1.40, // Hotspot!
      is_hotspot: true,
      distance_miles: 15,
    },
    {
      county: 'Prince William County',
      state: 'VA',
      population: 482000,
      demand_sqft: 2892000,
      estimated_supply_sqft: 2100000,
      supply_gap_sqft: 792000,
      supply_ratio: 1.38, // Hotspot!
      is_hotspot: true,
      distance_miles: 25,
    },
    {
      county: 'Fairfax County',
      state: 'VA',
      population: 1150000,
      demand_sqft: 6900000,
      estimated_supply_sqft: 5800000,
      supply_gap_sqft: 1100000,
      supply_ratio: 1.19, // Not a hotspot (< 1.25)
      is_hotspot: false,
      distance_miles: 0,
    },
    {
      county: 'Arlington County',
      state: 'VA',
      population: 238000,
      demand_sqft: 1428000,
      estimated_supply_sqft: 1350000,
      supply_gap_sqft: 78000,
      supply_ratio: 1.06, // Not a hotspot
      is_hotspot: false,
      distance_miles: 8,
    },
    {
      county: 'Montgomery County',
      state: 'MD',
      population: 1050000,
      demand_sqft: 6300000,
      estimated_supply_sqft: 5500000,
      supply_gap_sqft: 800000,
      supply_ratio: 1.15, // Not a hotspot
      is_hotspot: false,
      distance_miles: 12,
    },
  ];
}

/**
 * Handle dry-run mode for testing Pass 1
 */
async function handleDryRun(): Promise<Response> {
  await writeLog('pass1_dry_run_started', {
    timestamp: Date.now(),
  });

  try {
    // Create dummy data
    const testOpportunity = createDryRunOpportunity();
    const testHotspots = createDryRunHotspots();

    await writeLog('pass1_dry_run_complete', {
      success: true,
      tier: testOpportunity.pass1_recommendation.tier,
      score: testOpportunity.pass1_recommendation.viability_score,
      hotspot_count: testHotspots.filter(h => h.is_hotspot).length,
    });

    const response: StartPass1Response = {
      success: true,
      mode: 'dry-run',
      run_id: `dry_run_${Date.now()}`,
      status: 'pass1_complete',
      opportunity: ensureSerializable(testOpportunity),
      summary: {
        zip: testOpportunity.identity.zip,
        city: testOpportunity.identity.city,
        county: testOpportunity.identity.county,
        state: testOpportunity.identity.state_id,
        population: testOpportunity.pass1_macro.macro_demand?.population || 0,
        demand_sqft: testOpportunity.pass1_macro.macro_demand?.demand_sqft || 0,
        competitor_count: testOpportunity.pass1_macro.macro_supply?.competitor_count || 0,
        supply_sqft: testOpportunity.pass1_macro.macro_supply?.total_supply_sqft || 0,
        hotspot_count: testHotspots.filter(h => h.is_hotspot).length,
        county_count: testOpportunity.pass1_macro.radius_counties?.length || 0,
        viability_score: testOpportunity.pass1_recommendation.viability_score,
        tier: testOpportunity.pass1_recommendation.tier,
        recommendation: testOpportunity.pass1_recommendation.recommendation,
        key_factors: testOpportunity.pass1_recommendation.key_factors,
        risk_factors: testOpportunity.pass1_recommendation.risk_factors,
        proceed_to_pass2: testOpportunity.pass1_recommendation.proceed_to_pass2,
        // Enrichment summary
        reit_presence: false,
        grade_a_competitors: 0,
        competition_pressure: 45,
        // Validation summary
        validation_score: 85,
        completion_pct: 100,
      },
      hotspots: ensureSerializable(testHotspots),
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass1_dry_run_exception', error instanceof Error ? error : errorMessage);

    return Response.json({
      success: false,
      mode: 'dry-run',
      error: errorMessage,
      timestamp: Date.now(),
    } as StartPass1Response);
  }
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleStartPass1 };
