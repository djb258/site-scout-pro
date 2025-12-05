/**
 * PASS 1 ORCHESTRATOR
 *
 * Coordinates all Pass 1 spokes in sequence:
 *   1. hydrateZip() - Fetch ZIP metadata from Lovable.DB zip_master
 *   2. buildRadius120() - Build 120-mile county radius using Haversine
 *   3. runMacroDemand() - Calculate population-based demand (pop × 6 sqft)
 *   4. runMacroSupply() - Fetch competitors and calculate supply
 *   5. identifyHotspots() - Mark counties where demand > 1.25 × supply
 *   6. computeHotspotScore() - Generate composite viability score
 *   7. runLocalScanIfRequested() - Optional detailed scan (5-30mi radius)
 *   8. generateCallSheet() - Prep for AI dialer if needed
 *   9. assembleOpportunityObject() - Build final output
 *
 * Input: ZIP code + AnalysisToggles
 * Output: OpportunityObject ready for Pass 2 or Vault
 *
 * All returns are JSON-serializable (Lovable.dev compatible)
 */

import type {
  OpportunityObject,
  AnalysisToggles,
  Pass1MacroResults,
  Pass1Recommendation,
  HousingSignals,
  RvLakeSignals,
  IndustrialSignals,
  Anchor,
} from '../../shared/opportunity_object';

import { createEmptyOpportunityObject } from '../../shared/opportunity_object';
import { hydrateZip, validateZip } from '../spokes/zip_hydration';
import { buildRadius120, calculateRadiusEnumeration } from '../spokes/radius_builder';
import { runMacroDemand, calculateDemandFromZip, calculateRegionalDemand } from '../spokes/macro_demand';
import { runMacroSupply, fetchCompetitors } from '../spokes/macro_supply';
import { computeHotspots, identifyCountyHotspots, type CountyHotspot } from '../spokes/hotspot_scoring';
import { runLocalScan, checkPricingReadiness } from '../spokes/local_scan';
import { generateCallSheet, triggerCalls } from '../spokes/call_sheet';
import { writeLog, writeErrorLog, ensureSerializable } from '../../shared/lovable_adapter';

export interface Pass1Input {
  zip_code: string;
  toggles: AnalysisToggles;
  run_local_scan?: boolean;
  local_scan_radius?: number;
  trigger_ai_calls?: boolean;
}

export interface Pass1Output {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  opportunity: OpportunityObject | null;
  hotspots?: CountyHotspot[];
  summary?: Pass1Summary;
  error?: string;
}

export interface Pass1Summary {
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
  tier: 'A' | 'B' | 'C' | 'D';
  viability_score: number;
  proceed_to_pass2: boolean;
}

/**
 * Main Pass 1 Orchestrator
 * Runs all Pass-1 spokes and assembles the OpportunityObject
 */
export async function runPass1(input: Pass1Input): Promise<Pass1Output> {
  const { zip_code, toggles, run_local_scan, local_scan_radius, trigger_ai_calls } = input;

  console.log(`[PASS1_ORCHESTRATOR] Starting Pass 1 for ZIP: ${zip_code}`);

  // Validate ZIP
  if (!validateZip(zip_code)) {
    await writeErrorLog('pass1_invalid_zip', 'Invalid ZIP format', { zip: zip_code });
    return {
      success: false,
      status: 'error',
      opportunity: null,
      error: 'Invalid ZIP code format. Must be 5 digits.',
    };
  }

  // Create empty opportunity object
  const opportunity = createEmptyOpportunityObject(zip_code, toggles);
  let hotspots: CountyHotspot[] = [];

  try {
    await writeLog('pass1_started', { zip: zip_code, toggles });

    // =========================================================================
    // STEP 1: Hydrate ZIP (from Lovable.DB zip_master)
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 1: Hydrating ZIP...');
    const hydration = await hydrateZip({ zip: zip_code });

    if (!hydration.success || !hydration.zip_metadata || !hydration.identity) {
      console.warn('[PASS1_ORCHESTRATOR] ZIP hydration failed:', hydration.error);
      // Return error if we can't hydrate the ZIP
      return {
        success: false,
        status: 'error',
        opportunity: null,
        error: hydration.error || 'ZIP code not found in database',
      };
    }

    opportunity.identity = hydration.identity;
    opportunity.pass1_macro.zip_metadata = hydration.zip_metadata;

    // =========================================================================
    // STEP 2: Build 120-Mile Radius
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 2: Building 120-mile radius...');
    const radiusResult = await buildRadius120({
      lat: opportunity.identity.lat,
      lng: opportunity.identity.lng,
      state_id: opportunity.identity.state_id,
      radius_miles: 120,
    });

    if (radiusResult.success) {
      opportunity.pass1_macro.radius_counties = radiusResult.radius_counties;
    }

    // =========================================================================
    // STEP 3: Run Macro Demand
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 3: Calculating macro demand...');
    const macroDemand = runMacroDemand({
      population: opportunity.pass1_macro.zip_metadata.population || 0,
    });
    opportunity.pass1_macro.macro_demand = macroDemand;

    // =========================================================================
    // STEP 4: Run Macro Supply (Fetch Competitors)
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 4: Fetching competitors...');
    const competitors = await fetchCompetitors(
      opportunity.identity.lat,
      opportunity.identity.lng,
      10 // 10-mile radius for macro supply
    );
    opportunity.pass1_macro.competitors = competitors;

    const macroSupply = runMacroSupply({ competitors });
    opportunity.pass1_macro.macro_supply = macroSupply;

    // =========================================================================
    // STEP 5: Build Supporting Signals
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 5: Building supporting signals...');

    // Housing signals (from ZIP metadata)
    const housingSignals: HousingSignals = {
      median_home_value: opportunity.pass1_macro.zip_metadata.home_value || 0,
      home_ownership_rate: opportunity.pass1_macro.zip_metadata.home_ownership || 0,
      rent_median: opportunity.pass1_macro.zip_metadata.rent_median || 0,
      growth_indicator: macroDemand.population > 10000 ? 'high' : 'moderate',
    };
    opportunity.pass1_macro.housing_signals = housingSignals;

    // RV/Lake signals
    const rvLakeSignals: RvLakeSignals = {
      recreation_load: toggles.recreation_load,
      rv_potential: toggles.recreation_load ? 'high' : 'low',
      lake_proximity: false, // TODO: Query water_bodies table
      campground_nearby: false, // TODO: Query campgrounds table
    };
    opportunity.pass1_macro.rv_lake_signals = rvLakeSignals;

    // Industrial signals
    const industrialSignals: IndustrialSignals = {
      industrial_momentum: toggles.industrial_momentum,
      distribution_centers_nearby: 2, // TODO: Query demand_anchors
      manufacturing_presence: toggles.industrial_momentum ? 'moderate' : 'low',
    };
    opportunity.pass1_macro.industrial_signals = industrialSignals;

    // Anchors (placeholder)
    const anchors: Anchor[] = [
      { type: 'retail', name: 'Regional Shopping Center', distance_miles: 3.2 },
      { type: 'employer', name: 'Industrial Park', distance_miles: 5.1 },
    ];
    opportunity.pass1_macro.anchors = anchors;

    // =========================================================================
    // STEP 6: Compute Hotspot Score & Identify County Hotspots
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 6: Computing hotspot score...');
    const hotspotScore = computeHotspots({
      population: macroDemand.population,
      macro_supply: macroSupply,
      industrial_signals: industrialSignals,
      housing_signals: housingSignals,
      rv_lake_signals: rvLakeSignals,
      radius_counties: opportunity.pass1_macro.radius_counties,
      toggles,
      density: opportunity.pass1_macro.zip_metadata.density,
    });
    opportunity.pass1_macro.hotspot_score = hotspotScore;

    // Identify county-level hotspots (demand > 1.25 × supply)
    hotspots = identifyCountyHotspots(opportunity.pass1_macro.radius_counties);

    // =========================================================================
    // STEP 7: Run Local Scan (Optional)
    // =========================================================================
    if (run_local_scan && local_scan_radius) {
      console.log(`[PASS1_ORCHESTRATOR] Step 7: Running local scan (${local_scan_radius}mi)...`);
      const localScanResults = await runLocalScan({
        lat: opportunity.identity.lat,
        lng: opportunity.identity.lng,
        radius_miles: local_scan_radius,
        include_pricing: true,
        generate_call_sheet: true,
      });
      opportunity.local_scan = localScanResults;
      opportunity.local_scan_completed_at = new Date().toISOString();

      // Check pricing readiness
      const pricingReadiness = checkPricingReadiness(localScanResults.local_competitors);
      opportunity.pass2_prerequisites.has_pricing_data = pricingReadiness.ready_for_pass2;
      opportunity.pass2_prerequisites.has_competitor_list = true;
    }

    // =========================================================================
    // STEP 8: Generate Call Sheet & Trigger AI Calls (Optional)
    // =========================================================================
    if (opportunity.local_scan && trigger_ai_calls) {
      console.log('[PASS1_ORCHESTRATOR] Step 8: Generating call sheet...');
      const callSheetOutput = generateCallSheet({
        competitors: opportunity.local_scan.local_competitors,
        prioritize_by: 'distance',
      });
      opportunity.local_scan.call_sheet = callSheetOutput.call_sheet;

      if (callSheetOutput.total_calls_needed > 0) {
        console.log('[PASS1_ORCHESTRATOR] Triggering AI calls...');
        await triggerCalls(callSheetOutput.call_sheet);
      }
    }

    // =========================================================================
    // STEP 9: Assemble Pass 1 Recommendation
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 9: Assembling recommendation...');
    const recommendation = assemblePass1Recommendation(hotspotScore, toggles);
    opportunity.pass1_recommendation = recommendation;

    // =========================================================================
    // STEP 10: Set Prerequisites & Status
    // =========================================================================
    opportunity.pass2_ready = recommendation.proceed_to_pass2;
    opportunity.pass1_completed_at = new Date().toISOString();
    opportunity.status = 'pass1_complete';

    // Build summary
    const summary: Pass1Summary = {
      zip: zip_code,
      city: opportunity.identity.city,
      county: opportunity.identity.county,
      state: opportunity.identity.state_id,
      population: macroDemand.population,
      demand_sqft: macroDemand.demand_sqft,
      competitor_count: macroSupply.competitor_count,
      supply_sqft: macroSupply.total_supply_sqft,
      hotspot_count: hotspots.filter(h => h.is_hotspot).length,
      county_count: opportunity.pass1_macro.radius_counties.length,
      tier: recommendation.tier,
      viability_score: recommendation.viability_score,
      proceed_to_pass2: recommendation.proceed_to_pass2,
    };

    await writeLog('pass1_complete', {
      zip: zip_code,
      tier: recommendation.tier,
      score: recommendation.viability_score,
      county_count: summary.county_count,
      hotspot_count: summary.hotspot_count,
    });

    console.log(`[PASS1_ORCHESTRATOR] Pass 1 complete. Tier: ${recommendation.tier}, Score: ${recommendation.viability_score}`);

    return {
      success: true,
      status: 'ok',
      opportunity: ensureSerializable(opportunity),
      hotspots,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PASS1_ORCHESTRATOR] Error:', error);
    await writeErrorLog('pass1_error', error instanceof Error ? error : errorMessage, { zip: zip_code });

    return {
      success: false,
      status: 'error',
      opportunity: null,
      error: errorMessage,
    };
  }
}

/**
 * Assemble Pass 1 recommendation from hotspot score
 */
function assemblePass1Recommendation(
  hotspot: ReturnType<typeof computeHotspots>,
  toggles: AnalysisToggles
): Pass1Recommendation {
  const keyFactors: string[] = [];
  const riskFactors: string[] = [];

  // Analyze component scores
  if (hotspot.population_factor >= 75) {
    keyFactors.push('Strong population base');
  } else if (hotspot.population_factor < 50) {
    riskFactors.push('Limited population');
  }

  if (hotspot.competition_factor >= 70) {
    keyFactors.push('Low competition density');
  } else if (hotspot.competition_factor < 40) {
    riskFactors.push('High competition');
  }

  if (hotspot.industrial_factor >= 60 && toggles.industrial_momentum) {
    keyFactors.push('Strong industrial presence');
  }

  if (hotspot.multifamily_factor >= 60 && toggles.multifamily_priority) {
    keyFactors.push('High multifamily demand driver');
  }

  if (hotspot.recreation_factor >= 50 && toggles.recreation_load) {
    keyFactors.push('Recreation/RV storage opportunity');
  }

  // Generate recommendation
  let recommendation: string;
  let proceed_to_pass2: boolean;

  switch (hotspot.tier) {
    case 'A':
      recommendation = 'Strong candidate - proceed to Pass 2 deep dive';
      proceed_to_pass2 = true;
      break;
    case 'B':
      recommendation = 'Moderate potential - Pass 2 recommended for validation';
      proceed_to_pass2 = true;
      break;
    case 'C':
      recommendation = 'Marginal opportunity - review risks before proceeding';
      proceed_to_pass2 = true; // Still allow, but with caution
      break;
    case 'D':
    default:
      recommendation = 'Poor fit - consider alternative locations';
      proceed_to_pass2 = false;
      break;
  }

  return {
    viability_score: hotspot.overall_score,
    tier: hotspot.tier,
    recommendation,
    key_factors: keyFactors,
    risk_factors: riskFactors,
    proceed_to_pass2,
  };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { CountyHotspot };
