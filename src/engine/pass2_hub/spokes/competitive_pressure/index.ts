/**
 * COMPETITIVE PRESSURE SPOKE
 *
 * Responsibility: Deep analysis of competitive landscape and new supply pipeline
 *
 * Inputs:
 *   - pass1_macro.competitors: Competitor[]
 *   - county/state for pipeline lookup
 *
 * Outputs:
 *   - CompetitivePressureResult with saturation metrics
 *
 * Data Sources:
 *   - Neon: storage_facilities, storage_pipeline tables
 *   - Pass 1 competitor data
 */

import type {
  CompetitivePressureAnalysis,
  Competitor,
  MacroDemandResult,
  OpportunityObject,
} from '../../../shared/opportunity_object';
import type { CompetitivePressureResult } from '../../types/pass2_types';
import { createStubCompetitivePressure, createErrorResult } from '../../types/pass2_types';

export interface CompetitivePressureInput {
  competitors: Competitor[];
  macro_demand: MacroDemandResult;
  county_fips?: string;
  state: string;
}

export interface CompetitivePressureOutput {
  success: boolean;
  competitive_pressure: CompetitivePressureAnalysis | null;
  error?: string;
}

/**
 * Run competitive pressure analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @returns CompetitivePressureResult with status and saturation metrics
 */
export async function runCompPressureShell(opportunity: OpportunityObject): Promise<CompetitivePressureResult> {
  console.log(`[COMP_SPOKE] Running competitive pressure for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    // Extract competitors from pass1 data
    const competitors = opportunity.pass1_macro?.competitors || [];
    const population = opportunity.pass1_macro?.macro_demand?.population || 50000;

    // Count competitors by radius
    const within5mi = competitors.filter((c: Competitor) => c.distance_miles <= 5).length;
    const within10mi = competitors.filter((c: Competitor) => c.distance_miles <= 10).length;

    // Calculate total supply
    const totalSupplySqft = competitors.reduce((sum: number, c: Competitor) => sum + (c.estimated_sqft || 0), 0);

    // Calculate sqft per capita
    const sqftPerCapita = population > 0 ? totalSupplySqft / population : 0;

    // Determine saturation level (industry benchmark: 5-7 sqft per capita = balanced)
    let marketSaturation: CompetitivePressureResult['marketSaturation'] = 'balanced';
    if (sqftPerCapita < 5) marketSaturation = 'undersupplied';
    else if (sqftPerCapita > 8) marketSaturation = 'oversupplied';

    // Calculate saturation index (0-100)
    const saturationIndex = Math.min(100, Math.round((sqftPerCapita / 10) * 100));

    // Calculate pressure score (0-100, lower = less pressure = better)
    let pressureScore = 50; // Start neutral
    if (within5mi >= 5) pressureScore += 20;
    else if (within5mi >= 3) pressureScore += 10;
    else if (within5mi <= 1) pressureScore -= 15;
    if (sqftPerCapita > 8) pressureScore += 20;
    else if (sqftPerCapita < 5) pressureScore -= 20;
    pressureScore = Math.max(0, Math.min(100, pressureScore));

    const result: CompetitivePressureResult = {
      status: 'ok',
      competitorCount5mi: within5mi,
      competitorCount10mi: within10mi,
      localSupplySqFt: totalSupplySqft,
      sqftPerCapita: Math.round(sqftPerCapita * 100) / 100,
      saturationIndex,
      marketSaturation,
      newSupplyPipeline: 0, // TODO: Query storage_pipeline table
      pressureScore,
      notes: `STUB: Competitive pressure for ${opportunity.identity.county}, ${opportunity.identity.state}. ${within5mi} competitors within 5mi, ${sqftPerCapita.toFixed(1)} sqft/capita. TODO: Calculate saturation index.`,
    };

    console.log(`[COMP_SPOKE] Result: pressure=${result.pressureScore}, saturation=${result.marketSaturation}`);
    return result;
  } catch (error) {
    console.error('[COMP_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown competitive pressure error',
      createStubCompetitivePressure
    );
  }
}

/**
 * Run competitive pressure analysis (Legacy Interface)
 */
export async function runCompPressure(
  input: CompetitivePressureInput
): Promise<CompetitivePressureOutput> {
  const { competitors, macro_demand } = input;

  console.log(`[COMP_PRESSURE] Analyzing ${competitors.length} competitors`);

  // Count competitors by radius
  const within5mi = competitors.filter((c) => c.distance_miles <= 5).length;
  const within10mi = competitors.filter((c) => c.distance_miles <= 10).length;

  // Calculate total supply
  const totalSupplySqft = competitors.reduce((sum, c) => sum + (c.estimated_sqft || 0), 0);

  // Calculate sqft per capita
  const population = macro_demand.population || 1;
  const sqft_per_capita = totalSupplySqft / population;

  // Determine saturation level
  // Industry benchmark: 5-7 sqft per capita = balanced
  let market_saturation: CompetitivePressureAnalysis['market_saturation'];
  if (sqft_per_capita < 5) market_saturation = 'undersupplied';
  else if (sqft_per_capita > 8) market_saturation = 'oversupplied';
  else market_saturation = 'balanced';

  // TODO: Query Neon storage_pipeline for new supply coming online
  const new_supply_pipeline = 0; // sqft of planned/under construction

  // Calculate pressure score (0-100, lower = less pressure = better)
  let pressure_score = 50; // Start neutral

  // Adjust for competitor count
  if (within5mi >= 5) pressure_score += 20;
  else if (within5mi >= 3) pressure_score += 10;
  else if (within5mi <= 1) pressure_score -= 15;

  // Adjust for saturation
  if (sqft_per_capita > 8) pressure_score += 20;
  else if (sqft_per_capita < 5) pressure_score -= 20;

  // Adjust for new supply
  if (new_supply_pipeline > 50000) pressure_score += 15;
  else if (new_supply_pipeline > 25000) pressure_score += 8;

  pressure_score = Math.max(0, Math.min(100, pressure_score));

  const competitive_pressure: CompetitivePressureAnalysis = {
    competitor_count_5mi: within5mi,
    competitor_count_10mi: within10mi,
    sqft_per_capita: Math.round(sqft_per_capita * 100) / 100,
    market_saturation,
    new_supply_pipeline,
    pressure_score,
  };

  console.log(`[COMP_PRESSURE] Pressure Score: ${pressure_score}, Saturation: ${market_saturation}`);

  return {
    success: true,
    competitive_pressure,
  };
}

/**
 * Analyze competitor quality and positioning
 */
export function analyzeCompetitorQuality(competitors: Competitor[]): {
  avg_rating: number;
  reit_count: number;
  independent_count: number;
  climate_controlled_pct: number;
} {
  const withRating = competitors.filter((c) => c.rating);
  const avgRating = withRating.length > 0
    ? withRating.reduce((sum, c) => sum + (c.rating || 0), 0) / withRating.length
    : 0;

  // Identify REITs by name
  const reitNames = ['public storage', 'extra space', 'cubesmart', 'life storage', 'national storage'];
  const reitCount = competitors.filter((c) =>
    reitNames.some((r) => c.name.toLowerCase().includes(r))
  ).length;

  const climateControlled = competitors.filter((c) => c.climate_controlled).length;

  return {
    avg_rating: Math.round(avgRating * 10) / 10,
    reit_count: reitCount,
    independent_count: competitors.length - reitCount,
    climate_controlled_pct: competitors.length > 0
      ? Math.round((climateControlled / competitors.length) * 100)
      : 0,
  };
}

// Re-export types for convenience
export type { CompetitivePressureResult };
