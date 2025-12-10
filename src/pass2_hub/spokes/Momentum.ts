/**
 * INDUSTRIAL MOMENTUM SPOKE
 *
 * Responsibility: Deep analysis of industrial/logistics growth factors
 *
 * Inputs:
 *   - pass1_macro.industrial_signals: IndustrialSignals
 *   - county_fips: string
 *   - state: string
 *
 * Outputs:
 *   - MomentumResult with growth metrics (combined industrial + housing)
 *
 * Data Sources:
 *   - Neon: mfg_announcements, distribution_centers, employment_data
 *   - Pass 1 industrial signals
 */

import type { IndustrialMomentum, IndustrialSignals, OpportunityObject } from '../../shared/OpportunityObject';
import type { MomentumResult } from '../types/pass2_types';
import { createStubMomentum, createErrorResult } from '../types/pass2_types';

export interface IndustrialMomentumInput {
  pass1_industrial: IndustrialSignals;
  county_fips?: string;
  state: string;
  county: string;
}

export interface IndustrialMomentumOutput {
  success: boolean;
  industrial_momentum: IndustrialMomentum | null;
  data_sources: string[];
  error?: string;
}

/**
 * Run momentum analysis (New Pass-2 Shell Interface)
 * Combines industrial momentum and housing pipeline into single result
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @returns MomentumResult with status and combined industrial/housing metrics
 */
export async function runMomentumShell(opportunity: OpportunityObject): Promise<MomentumResult> {
  console.log(`[MOMENTUM_SPOKE] Running momentum analysis for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    // Extract industrial signals from pass1
    const industrialSignals = opportunity.pass1_macro?.industrial_signals;
    const housingSignals = opportunity.pass1_macro?.housing_signals;

    // Calculate industrial metrics
    const distCenters = industrialSignals?.distribution_centers_nearby || 0;
    const mfgPresence = industrialSignals?.manufacturing_presence || 'low';

    let growthRatePct = 0;
    if (mfgPresence === 'high') growthRatePct = 4.5;
    else if (mfgPresence === 'moderate') growthRatePct = 2.5;
    else growthRatePct = 0.5;

    // Calculate logistics score (0-100)
    let logisticsScore = 40;
    logisticsScore += Math.min(40, distCenters * 15);
    if (industrialSignals?.logistics_corridors?.includes('interstate')) {
      logisticsScore += 20;
    }
    logisticsScore = Math.min(100, logisticsScore);

    // Determine industrial momentum rating
    let industrialMomentumRating: MomentumResult['industrialMomentumRating'] = 'weak';
    const combinedScore = (growthRatePct * 10) + (logisticsScore * 0.5);
    if (combinedScore >= 70) industrialMomentumRating = 'strong';
    else if (combinedScore >= 40) industrialMomentumRating = 'moderate';

    // Calculate industrial index
    const industrialIndex = Math.round(combinedScore);

    // Major employers stub
    const majorEmployers: string[] = [];
    if (distCenters > 0) majorEmployers.push('Distribution Center A');
    if (mfgPresence !== 'low') majorEmployers.push('Manufacturing Co B');

    // Calculate housing metrics
    const newUnitsPlanned = housingSignals?.new_construction_permits || 200;
    const multifamilyUnits = housingSignals?.multifamily_units || 0;

    // Determine density trend
    let densityTrend: MomentumResult['densityTrend'] = 'stable';
    if (housingSignals?.growth_indicator === 'high') densityTrend = 'increasing';
    else if (housingSignals?.growth_indicator === 'low') densityTrend = 'decreasing';

    // Calculate multifamily share
    const totalUnits = newUnitsPlanned + multifamilyUnits;
    const multifamilySharePct = totalUnits > 0
      ? Math.round((multifamilyUnits / totalUnits) * 100)
      : 35;

    // Demand projection: ~10 sqft storage demand per new housing unit
    const demandProjectionSqft = newUnitsPlanned * 10;

    // Timeline alignment
    let timelineAlignment: MomentumResult['timelineAlignment'] = 'neutral';
    if (newUnitsPlanned > 300 && densityTrend === 'increasing') {
      timelineAlignment = 'favorable';
    } else if (newUnitsPlanned < 50) {
      timelineAlignment = 'delayed';
    }

    // Housing growth score
    const housingGrowth = newUnitsPlanned > 500 ? 90 : newUnitsPlanned > 200 ? 70 : newUnitsPlanned > 100 ? 50 : 30;

    const result: MomentumResult = {
      status: 'ok',
      // Industrial metrics
      industrialGrowthRatePct: growthRatePct,
      majorEmployers,
      logisticsScore,
      warehouseVacancyPct: 5.0, // TODO: Fetch from market data
      newIndustrialSqft: distCenters * 50000, // Estimate
      industrialMomentumRating,
      industrialIndex,
      // Housing metrics
      newUnitsPlanned,
      constructionTimeline: '2024-2026', // TODO: Calculate from actual data
      densityTrend,
      multifamilySharePct,
      demandProjectionSqft,
      timelineAlignment,
      housingGrowth,
      notes: `STUB: Momentum analysis for ${opportunity.identity.county}, ${opportunity.identity.state}. Industrial: ${industrialMomentumRating}, Housing: ${newUnitsPlanned} units. TODO: Fetch industrial + housing data.`,
    };

    console.log(`[MOMENTUM_SPOKE] Result: industrial=${result.industrialMomentumRating}, housing=${result.newUnitsPlanned} units`);
    return result;
  } catch (error) {
    console.error('[MOMENTUM_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown momentum error',
      createStubMomentum
    );
  }
}

/**
 * Run industrial momentum analysis (Legacy Interface)
 *
 * TODO: Implement Neon queries for deep industrial data
 */
export async function runIndustrialMomentum(
  input: IndustrialMomentumInput
): Promise<IndustrialMomentumOutput> {
  const { pass1_industrial, county, state } = input;

  console.log(`[INDUSTRIAL] Analyzing industrial momentum for ${county}, ${state}`);

  // TODO: Query Neon mfg_announcements for recent projects
  // SELECT * FROM mfg_announcements WHERE county = ? AND state = ?

  // TODO: Query Neon distribution_centers for logistics presence
  // SELECT * FROM distribution_centers WHERE county = ? AND state = ?

  // TODO: Query Neon employment_data for job growth
  // SELECT * FROM employment_data WHERE county_fips = ?

  // Build from Pass 1 signals + stub data
  const distCenters = pass1_industrial.distribution_centers_nearby || 0;
  const mfgPresence = pass1_industrial.manufacturing_presence;

  // Calculate growth score
  let growthRatePct = 0;
  if (mfgPresence === 'high') growthRatePct = 4.5;
  else if (mfgPresence === 'moderate') growthRatePct = 2.5;
  else growthRatePct = 0.5;

  // Calculate logistics score (0-100)
  let logisticsScore = 40; // Base score
  logisticsScore += Math.min(40, distCenters * 15);
  if (pass1_industrial.logistics_corridors?.includes('interstate')) {
    logisticsScore += 20;
  }
  logisticsScore = Math.min(100, logisticsScore);

  // Determine momentum rating
  let momentumRating: IndustrialMomentum['momentum_rating'] = 'weak';
  const combinedScore = (growthRatePct * 10) + (logisticsScore * 0.5);
  if (combinedScore >= 70) momentumRating = 'strong';
  else if (combinedScore >= 40) momentumRating = 'moderate';

  // Stub major employers
  const majorEmployers: string[] = [];
  if (distCenters > 0) majorEmployers.push('Distribution Center A');
  if (mfgPresence !== 'low') majorEmployers.push('Manufacturing Co B');

  const industrial_momentum: IndustrialMomentum = {
    growth_rate_pct: growthRatePct,
    major_employers: majorEmployers,
    logistics_score: logisticsScore,
    warehouse_vacancy_pct: 5.0, // TODO: Fetch from market data
    new_industrial_sqft: distCenters * 50000, // Estimate
    momentum_rating: momentumRating,
  };

  console.log(`[INDUSTRIAL] Rating: ${momentumRating}, Growth: ${growthRatePct}%`);

  return {
    success: true,
    industrial_momentum,
    data_sources: ['pass1_signals'], // TODO: Add actual sources
  };
}

/**
 * Score industrial presence from Pass 1 data
 * (Fallback when deep data not available)
 */
export function scoreIndustrialFromPass1(signals: IndustrialSignals): {
  score: number;
  rating: 'strong' | 'moderate' | 'weak';
} {
  let score = 0;

  // Distribution centers
  score += Math.min(40, signals.distribution_centers_nearby * 15);

  // Manufacturing presence
  if (signals.manufacturing_presence === 'high') score += 35;
  else if (signals.manufacturing_presence === 'moderate') score += 20;
  else score += 5;

  // Momentum flag
  if (signals.industrial_momentum) score += 15;

  score = Math.min(100, score);

  let rating: 'strong' | 'moderate' | 'weak' = 'weak';
  if (score >= 70) rating = 'strong';
  else if (score >= 40) rating = 'moderate';

  return { score, rating };
}

// Re-export types for convenience
export type { MomentumResult };
