/**
 * PASS 1 ORCHESTRATOR (Recon Hub - Final Version)
 *
 * Coordinates all Pass 1 spokes in sequence:
 *   1. hydrateZip() - Fetch ZIP metadata from Lovable.DB zip_master
 *   2. buildRadius120() - Build 120-mile county radius using Haversine
 *   3. runMacroDemand() - Calculate population-based demand (pop × 6 sqft)
 *   4. runMacroSupply() - Fetch competitors and calculate supply
 *   5. identifyHotspots() - Mark counties where demand > 1.25 × supply
 *   6. computeHotspotScore() - Generate composite viability score
 *   7. enrichCompetitors() - Classify competitors (A/B/C grade + type + est sqft)
 *   8. runLocalScanIfRequested() - Optional detailed scan (5-30mi radius)
 *   9. generateCallSheet() - Prep for AI dialer if needed
 *  10. validateForPass2() - Ensure OpportunityObject is complete before Pass-2
 *  11. assembleOpportunityObject() - Build final output
 *  12. writeToPass1Runs() - Persist to pass1_runs table
 *
 * Input: ZIP code + AnalysisToggles
 * Output: OpportunityObject ready for Pass 2 or Vault (JSON-serializable)
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
  Pass1ValidationResult,
} from '../../shared/OpportunityObject';

import { createEmptyOpportunityObject } from '../../shared/OpportunityObject';
import { hydrateZip, validateZip } from '../spokes/ZipHydration';
import { buildRadius120, calculateRadiusEnumeration } from '../spokes/RadiusBuilder';
import { runMacroDemand, calculateDemandFromZip, calculateRegionalDemand } from '../spokes/MacroDemand';
import { runMacroSupply, fetchCompetitors } from '../spokes/MacroSupply';
import { computeHotspots, identifyCountyHotspots, type CountyHotspot } from '../spokes/HotspotScoring';
import { runLocalScan, checkPricingReadiness } from '../spokes/LocalScan';
import { generateCallSheet, triggerCalls } from '../spokes/CallSheet';
import { enrichCompetitors, calculateGradedPressure, identifyPrimaryThreat } from '../spokes/CompetitorEnrichment';
import { validateForPass2, isPass2Ready, getCompletionPercentage } from '../spokes/ValidationGate';
import {
  writeLog,
  writeErrorLog,
  ensureSerializable,
  writeData,
  TABLES,
  stageOpportunity,
} from '../../shared/adapters/LovableAdapter';

// ============================================================================
// TYPES
// ============================================================================

export interface Pass1Input {
  zip_code: string;
  toggles: AnalysisToggles;
  run_local_scan?: boolean;
  local_scan_radius?: number;
  trigger_ai_calls?: boolean;
  strict_validation?: boolean; // If true, warnings become blockers
}

export interface Pass1Output {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  opportunity: OpportunityObject | null;
  hotspots?: CountyHotspot[];
  summary?: Pass1Summary;
  validation?: Pass1ValidationResult;
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
  // NEW: Enrichment summary
  reit_presence: boolean;
  grade_a_competitors: number;
  competition_pressure: number;
  // NEW: Validation summary
  validation_score: number;
  completion_pct: number;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Main Pass 1 Orchestrator
 * Runs all Pass-1 spokes and assembles the OpportunityObject
 */
export async function runPass1(input: Pass1Input): Promise<Pass1Output> {
  const {
    zip_code,
    toggles,
    run_local_scan,
    local_scan_radius,
    trigger_ai_calls,
    strict_validation = false
  } = input;

  console.log(`[PASS1_ORCHESTRATOR] Starting Pass 1 for ZIP: ${zip_code}`);
  console.log(`[PASS1_ORCHESTRATOR] Toggles: ${JSON.stringify(toggles)}`);

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
    // STEP 3: Run Macro Demand (Population × 6 sqft rule)
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 3: Calculating macro demand...');
    const macroDemand = runMacroDemand({
      population: opportunity.pass1_macro.zip_metadata.population || 0,
    });
    opportunity.pass1_macro.macro_demand = macroDemand;

    // Also calculate regional demand for the 120-mile radius
    const regionalDemand = calculateRegionalDemand(opportunity.pass1_macro.radius_counties);
    console.log(`[PASS1_ORCHESTRATOR] Regional demand: ${regionalDemand.total_demand_sqft.toLocaleString()} sqft across ${regionalDemand.county_count} counties`);

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
    // Hotspot = demand/supply ≥ 1.25
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
    // STEP 7: Enrich Competitors (NEW - Grade A/B/C classification)
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 7: Enriching competitors...');
    const enrichmentResult = await enrichCompetitors({
      competitors: opportunity.pass1_macro.competitors,
    });

    if (enrichmentResult.success) {
      opportunity.pass1_macro.competitors = enrichmentResult.enriched_competitors;
      opportunity.pass1_macro.competitor_enrichment = enrichmentResult.summary;

      // Calculate graded competition pressure
      const gradedPressure = calculateGradedPressure(enrichmentResult.enriched_competitors);
      console.log(`[PASS1_ORCHESTRATOR] Graded competition pressure: ${gradedPressure}`);

      // Identify primary threat
      const primaryThreat = identifyPrimaryThreat(enrichmentResult.enriched_competitors);
      if (primaryThreat) {
        console.log(`[PASS1_ORCHESTRATOR] Primary competitive threat: ${primaryThreat.name} (Grade ${primaryThreat.grade})`);
      }
    }

    // =========================================================================
    // STEP 8: Run Local Scan (Optional - 5-30mi micro-demand/supply)
    // =========================================================================
    if (run_local_scan && local_scan_radius) {
      console.log(`[PASS1_ORCHESTRATOR] Step 8: Running local scan (${local_scan_radius}mi)...`);
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
    // STEP 9: Generate Call Sheet & Trigger AI Calls (Optional)
    // =========================================================================
    if (opportunity.local_scan && trigger_ai_calls) {
      console.log('[PASS1_ORCHESTRATOR] Step 9: Generating call sheet...');
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
    // STEP 10: Validation Gate (NEW - Ensure completeness before Pass-2)
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 10: Running validation gate...');
    const validationResult = await validateForPass2({
      opportunity,
      strict_mode: strict_validation,
    });

    opportunity.pass1_macro.validation = validationResult.validation;

    // =========================================================================
    // STEP 11: Assemble Pass 1 Recommendation
    // =========================================================================
    console.log('[PASS1_ORCHESTRATOR] Step 11: Assembling recommendation...');
    const recommendation = assemblePass1Recommendation(
      hotspotScore,
      toggles,
      validationResult.can_proceed_to_pass2,
      opportunity.pass1_macro.competitor_enrichment
    );
    opportunity.pass1_recommendation = recommendation;

    // =========================================================================
    // STEP 12: Set Prerequisites & Status, Write to pass1_runs
    // =========================================================================
    opportunity.pass2_ready = recommendation.proceed_to_pass2 && validationResult.can_proceed_to_pass2;
    opportunity.pass1_completed_at = new Date().toISOString();
    opportunity.status = 'pass1_complete';

    // Write full opportunity object to pass1_runs table
    console.log('[PASS1_ORCHESTRATOR] Step 12: Writing to pass1_runs...');
    await writeData(TABLES.PASS1_RUNS, {
      zip_code,
      opportunity_id: opportunity.id,
      status: 'complete',
      tier: recommendation.tier,
      viability_score: recommendation.viability_score,
      proceed_to_pass2: recommendation.proceed_to_pass2,
      validation_score: validationResult.validation.validation_score,
      toggles,
      created_at: opportunity.created_at,
      completed_at: opportunity.pass1_completed_at,
    });

    // Stage full opportunity for potential retrieval
    await stageOpportunity(opportunity.id, opportunity);

    // Build summary
    const completion_pct = getCompletionPercentage(opportunity);
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
      // NEW: Enrichment summary
      reit_presence: opportunity.pass1_macro.competitor_enrichment?.reit_presence || false,
      grade_a_competitors: opportunity.pass1_macro.competitor_enrichment?.grade_a_count || 0,
      competition_pressure: calculateGradedPressure(opportunity.pass1_macro.competitors),
      // NEW: Validation summary
      validation_score: validationResult.validation.validation_score,
      completion_pct,
    };

    await writeLog('pass1_complete', {
      zip: zip_code,
      tier: recommendation.tier,
      score: recommendation.viability_score,
      county_count: summary.county_count,
      hotspot_count: summary.hotspot_count,
      validation_score: validationResult.validation.validation_score,
      completion_pct,
      reit_presence: summary.reit_presence,
    });

    console.log(`[PASS1_ORCHESTRATOR] Pass 1 complete. Tier: ${recommendation.tier}, Score: ${recommendation.viability_score}, Validation: ${validationResult.validation.validation_score}%`);

    return {
      success: true,
      status: 'ok',
      opportunity: ensureSerializable(opportunity),
      hotspots,
      summary,
      validation: validationResult.validation,
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

// ============================================================================
// RECOMMENDATION ASSEMBLY
// ============================================================================

/**
 * Assemble Pass 1 recommendation from hotspot score and enrichment data
 */
function assemblePass1Recommendation(
  hotspot: ReturnType<typeof computeHotspots>,
  toggles: AnalysisToggles,
  validationPassed: boolean,
  enrichment?: Pass1MacroResults['competitor_enrichment']
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

  // NEW: Enrichment-based factors
  if (enrichment) {
    if (enrichment.reit_presence) {
      riskFactors.push(`REIT competition (${enrichment.grade_a_count} Grade-A facilities)`);
    } else {
      keyFactors.push('No major REIT presence');
    }

    if (enrichment.grade_c_count > enrichment.grade_a_count + enrichment.grade_b_count) {
      keyFactors.push('Market dominated by Mom & Pop operators');
    }
  }

  // Validation factors
  if (!validationPassed) {
    riskFactors.push('Incomplete data - validation failed');
  }

  // Generate recommendation
  let recommendation: string;
  let proceed_to_pass2: boolean;

  switch (hotspot.tier) {
    case 'A':
      recommendation = 'Strong candidate - proceed to Pass 2 deep dive';
      proceed_to_pass2 = validationPassed;
      break;
    case 'B':
      recommendation = 'Moderate potential - Pass 2 recommended for validation';
      proceed_to_pass2 = validationPassed;
      break;
    case 'C':
      recommendation = 'Marginal opportunity - review risks before proceeding';
      proceed_to_pass2 = validationPassed; // Still allow, but with caution
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
export { isPass2Ready, getCompletionPercentage };
