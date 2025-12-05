/**
 * HOUSING PIPELINE SPOKE
 *
 * Responsibility: Analyze housing development pipeline for demand projection
 *
 * Inputs:
 *   - pass1_macro.housing_signals: HousingSignals
 *   - county_fips: string
 *   - state: string
 *
 * Outputs:
 *   - HousingPipeline with new unit counts and timelines
 *
 * Data Sources:
 *   - Neon: housing_pipeline, housing_communities, permits_raw
 *   - Scraped permit data
 */

import type { HousingPipeline, HousingSignals } from '../../../shared/opportunity_object';

export interface HousingPipelineInput {
  pass1_housing: HousingSignals;
  county_fips?: string;
  state: string;
  county: string;
}

export interface HousingPipelineOutput {
  success: boolean;
  housing_pipeline: HousingPipeline | null;
  data_sources: string[];
  error?: string;
}

/**
 * Run housing pipeline analysis
 *
 * TODO: Implement Neon queries for housing pipeline data
 */
export async function runHousingPipeline(
  input: HousingPipelineInput
): Promise<HousingPipelineOutput> {
  const { pass1_housing, county, state } = input;

  console.log(`[HOUSING] Analyzing housing pipeline for ${county}, ${state}`);

  // TODO: Query Neon housing_pipeline for planned developments
  // SELECT * FROM housing_pipeline WHERE county_fips = ? AND pipeline_status IN ('GREEN', 'YELLOW')

  // TODO: Query Neon permits_raw for recent housing permits
  // SELECT * FROM permits_raw WHERE county_fips = ? AND is_housing_related = true

  // TODO: Query Neon housing_communities for existing developments
  // SELECT * FROM housing_communities WHERE county_fips = ?

  // Build from Pass 1 signals + stub data
  const newUnitsPlanned = pass1_housing.new_construction_permits || 200;
  const multifamilyUnits = pass1_housing.multifamily_units || 0;

  // Determine density trend
  let densityTrend: HousingPipeline['density_trend'] = 'stable';
  if (pass1_housing.growth_indicator === 'high') densityTrend = 'increasing';
  else if (pass1_housing.growth_indicator === 'low') densityTrend = 'decreasing';

  // Calculate multifamily share
  const totalUnits = newUnitsPlanned + multifamilyUnits;
  const multifamilySharePct = totalUnits > 0
    ? Math.round((multifamilyUnits / totalUnits) * 100)
    : 35; // Default assumption

  // Demand projection: ~10 sqft storage demand per new housing unit
  const demandProjectionSqft = newUnitsPlanned * 10;

  // Timeline alignment (how well does housing timeline match storage development)
  let timelineAlignment: HousingPipeline['timeline_alignment'] = 'neutral';
  if (newUnitsPlanned > 300 && densityTrend === 'increasing') {
    timelineAlignment = 'favorable';
  } else if (newUnitsPlanned < 50) {
    timelineAlignment = 'delayed';
  }

  const housing_pipeline: HousingPipeline = {
    new_units_planned: newUnitsPlanned,
    construction_timeline: '2024-2026', // TODO: Calculate from actual data
    density_trend: densityTrend,
    multifamily_share_pct: multifamilySharePct,
    demand_projection_sqft: demandProjectionSqft,
    timeline_alignment: timelineAlignment,
  };

  console.log(`[HOUSING] New Units: ${newUnitsPlanned}, Demand Projection: ${demandProjectionSqft.toLocaleString()} sqft`);

  return {
    success: true,
    housing_pipeline,
    data_sources: ['pass1_signals'], // TODO: Add actual sources
  };
}

/**
 * Calculate housing demand impact on storage
 * (Moved from pass2Calculators.ts)
 */
export function calculateHousingDemandImpact(newUnits: number): {
  impact_score: number;
  demand_sqft: number;
  impact_level: 'high' | 'moderate' | 'low';
} {
  // ~10 sqft storage demand per new housing unit
  const demandSqft = newUnits * 10;

  let impactScore = 0;
  let impactLevel: 'high' | 'moderate' | 'low' = 'low';

  if (newUnits > 500) {
    impactScore = 90;
    impactLevel = 'high';
  } else if (newUnits > 200) {
    impactScore = 70;
    impactLevel = 'moderate';
  } else if (newUnits > 100) {
    impactScore = 50;
    impactLevel = 'moderate';
  } else if (newUnits > 50) {
    impactScore = 30;
    impactLevel = 'low';
  } else {
    impactScore = 10;
    impactLevel = 'low';
  }

  return {
    impact_score: impactScore,
    demand_sqft: demandSqft,
    impact_level: impactLevel,
  };
}
