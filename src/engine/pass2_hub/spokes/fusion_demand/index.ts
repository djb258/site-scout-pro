/**
 * FUSION DEMAND SPOKE
 *
 * Responsibility: Combined demand analysis incorporating all demand drivers
 *
 * Formula (Fusion Score):
 *   Industrial Momentum: 55% weight
 *   Absorption Pressure (Housing): 25% weight
 *   Population Baseline: 20% weight
 *
 * Inputs:
 *   - pass1_macro: Pass1MacroResults
 *   - industrial_momentum: IndustrialMomentum
 *   - housing_pipeline: HousingPipeline
 *
 * Outputs:
 *   - FusionDemandResult with composite demand score
 */

import type {
  FusionDemandResult as LegacyFusionDemandResult,
  Pass1MacroResults,
  IndustrialMomentum,
  HousingPipeline,
  MacroSupplyResult,
  OpportunityObject,
} from '../../../shared/opportunity_object';
import type { FusionDemandResult, MomentumResult } from '../../types/pass2_types';
import { createStubFusion, createErrorResult } from '../../types/pass2_types';

export interface FusionDemandInput {
  pass1_macro: Pass1MacroResults;
  industrial_momentum: IndustrialMomentum;
  housing_pipeline: HousingPipeline;
}

// Fusion Score Weights
const INDUSTRIAL_WEIGHT = 0.55;
const HOUSING_WEIGHT = 0.25;
const POPULATION_WEIGHT = 0.20;

/**
 * Run fusion demand analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @param momentum - MomentumResult from industrial/housing analysis
 * @returns FusionDemandResult with status and composite demand score
 */
export function runFusionShell(opportunity: OpportunityObject, momentum: MomentumResult): FusionDemandResult {
  console.log(`[FUSION_SPOKE] Running fusion demand for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    // Extract data from pass1_macro
    const population = opportunity.pass1_macro?.macro_demand?.population || 50000;
    const demandSqft = opportunity.pass1_macro?.macro_demand?.demand_sqft || 100000;
    const supplySqft = opportunity.pass1_macro?.macro_supply?.total_supply_sqft || 80000;

    // Calculate supply gap
    const supplyGapSqft = demandSqft - supplySqft;

    // Calculate component scores (0-100) from momentum data
    let industrialScore = 50; // Default
    if (momentum.industrialMomentumRating === 'strong') industrialScore = 90;
    else if (momentum.industrialMomentumRating === 'moderate') industrialScore = 60;
    else if (momentum.industrialMomentumRating === 'weak') industrialScore = 30;

    let housingScore = 50; // Default
    const newUnits = momentum.newUnitsPlanned || 200;
    if (newUnits > 500) housingScore = 90;
    else if (newUnits > 200) housingScore = 70;
    else if (newUnits > 100) housingScore = 50;
    else housingScore = 30;

    let populationScore = 50; // Default
    if (population > 100000) populationScore = 100;
    else if (population > 50000) populationScore = 80;
    else if (population > 25000) populationScore = 60;
    else populationScore = 40;

    // Calculate weighted fusion score
    const demandScore = Math.round(
      industrialScore * INDUSTRIAL_WEIGHT +
      housingScore * HOUSING_WEIGHT +
      populationScore * POPULATION_WEIGHT
    );

    // Determine market timing
    let marketTiming: FusionDemandResult['marketTiming'] = 'neutral';
    if (supplyGapSqft > 50000 && housingScore > 60) marketTiming = 'favorable';
    else if (supplyGapSqft < 0) marketTiming = 'unfavorable';

    // Determine competition intensity
    let competitionIntensity: FusionDemandResult['competitionIntensity'] = 'moderate';
    const densityScore = opportunity.pass1_macro?.macro_supply?.density_score || 50;
    if (densityScore >= 70) competitionIntensity = 'low';
    else if (densityScore <= 40) competitionIntensity = 'high';

    const result: FusionDemandResult = {
      status: 'ok',
      demandScore,
      supplyGapSqFt: supplyGapSqft,
      households: Math.round(population / 2.5), // Estimate households
      demandSqFt: demandSqft,
      marketTiming,
      competitionIntensity,
      overallScore: demandScore,
      industrialContribution: Math.round(industrialScore * INDUSTRIAL_WEIGHT),
      housingContribution: Math.round(housingScore * HOUSING_WEIGHT),
      populationContribution: Math.round(populationScore * POPULATION_WEIGHT),
      notes: `STUB: Fusion demand for ${opportunity.identity.county}, ${opportunity.identity.state}. Score=${demandScore}, Gap=${supplyGapSqft.toLocaleString()} sqft. TODO: Implement weighted scoring formula.`,
    };

    console.log(`[FUSION_SPOKE] Result: score=${result.demandScore}, gap=${result.supplyGapSqFt?.toLocaleString()} sqft`);
    return result;
  } catch (error) {
    console.error('[FUSION_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown fusion error',
      createStubFusion
    );
  }
}

/**
 * Run fusion demand analysis (Legacy Interface)
 */
export function runFusionDemand(input: FusionDemandInput): LegacyFusionDemandResult {
  const { pass1_macro, industrial_momentum, housing_pipeline } = input;

  console.log('[FUSION_DEMAND] Calculating fusion demand score...');

  // Calculate component scores (0-100)

  // Industrial contribution
  let industrial_score = 0;
  if (industrial_momentum.momentum_rating === 'strong') industrial_score = 90;
  else if (industrial_momentum.momentum_rating === 'moderate') industrial_score = 60;
  else industrial_score = 30;

  // Add logistics and growth factors
  industrial_score = Math.min(100,
    industrial_score +
    (industrial_momentum.logistics_score || 0) * 0.1 +
    (industrial_momentum.growth_rate_pct || 0) * 2
  );

  // Housing contribution
  let housing_score = 0;
  if (housing_pipeline.new_units_planned > 500) housing_score = 90;
  else if (housing_pipeline.new_units_planned > 200) housing_score = 70;
  else if (housing_pipeline.new_units_planned > 100) housing_score = 50;
  else if (housing_pipeline.new_units_planned > 50) housing_score = 30;
  else housing_score = 10;

  // Timeline alignment bonus
  if (housing_pipeline.timeline_alignment === 'favorable') housing_score += 10;

  // Density trend adjustment
  if (housing_pipeline.density_trend === 'increasing') housing_score += 10;
  else if (housing_pipeline.density_trend === 'decreasing') housing_score -= 10;

  housing_score = Math.min(100, Math.max(0, housing_score));

  // Population contribution
  const population = pass1_macro.macro_demand.population;
  let population_score = 0;
  if (population > 100000) population_score = 100;
  else if (population > 50000) population_score = 80;
  else if (population > 25000) population_score = 60;
  else if (population > 10000) population_score = 40;
  else population_score = 20;

  // Calculate weighted fusion score
  const demand_score = Math.round(
    industrial_score * INDUSTRIAL_WEIGHT +
    housing_score * HOUSING_WEIGHT +
    population_score * POPULATION_WEIGHT
  );

  // Calculate supply gap
  const demand_sqft = pass1_macro.macro_demand.demand_sqft;
  const supply_sqft = pass1_macro.macro_supply.total_supply_sqft;
  const supply_gap_sqft = demand_sqft - supply_sqft;

  // Determine market timing (snake_case for legacy interface)
  type LegacyMarketTiming = 'favorable' | 'neutral' | 'unfavorable';
  let market_timing: LegacyMarketTiming = 'neutral';
  if (supply_gap_sqft > 50000 && housing_score > 60) market_timing = 'favorable';
  else if (supply_gap_sqft < 0) market_timing = 'unfavorable';

  // Determine competition intensity (snake_case for legacy interface)
  type LegacyCompetitionIntensity = 'low' | 'moderate' | 'high';
  let competition_intensity: LegacyCompetitionIntensity = 'moderate';
  if (pass1_macro.macro_supply.density_score >= 70) competition_intensity = 'low';
  else if (pass1_macro.macro_supply.density_score <= 40) competition_intensity = 'high';

  // Overall score (same as demand_score, could be adjusted)
  const overall_score = demand_score;

  console.log(`[FUSION_DEMAND] Score: ${demand_score}, Gap: ${supply_gap_sqft.toLocaleString()} sqft`);

  // Return legacy format with snake_case properties
  return {
    demand_score,
    supply_gap_sqft,
    market_timing,
    competition_intensity,
    overall_score,
    industrial_contribution: Math.round(industrial_score * INDUSTRIAL_WEIGHT),
    housing_contribution: Math.round(housing_score * HOUSING_WEIGHT),
    population_contribution: Math.round(population_score * POPULATION_WEIGHT),
  } as LegacyFusionDemandResult;
}

/**
 * Calculate supply gap from demand and supply
 */
export function calculateSupplyGap(
  macroDemand: { demand_sqft: number },
  macroSupply: MacroSupplyResult
): {
  gap_sqft: number;
  gap_pct: number;
  market_status: 'undersupplied' | 'balanced' | 'oversupplied';
} {
  const gap_sqft = macroDemand.demand_sqft - macroSupply.total_supply_sqft;
  const gap_pct = macroDemand.demand_sqft > 0
    ? (gap_sqft / macroDemand.demand_sqft) * 100
    : 0;

  let market_status: 'undersupplied' | 'balanced' | 'oversupplied';
  if (gap_pct > 20) market_status = 'undersupplied';
  else if (gap_pct < -10) market_status = 'oversupplied';
  else market_status = 'balanced';

  return { gap_sqft, gap_pct, market_status };
}

// Re-export types for convenience
export type { FusionDemandResult };
