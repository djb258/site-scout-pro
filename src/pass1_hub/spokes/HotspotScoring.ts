/**
 * HOTSPOT SCORING SPOKE
 *
 * Responsibility: Compute composite viability score from all Pass 1 factors
 * Also identifies county-level hotspots where demand > 1.25 × supply
 *
 * Weights (configurable):
 *   - Population: 20%
 *   - Competition Density: 25%
 *   - Industrial: 15-20% (boosted if industrial_momentum flag)
 *   - Multifamily: 15-20% (boosted if multifamily_priority flag)
 *   - Recreation: 10-15% (boosted if recreation_load flag)
 *   - Regional Coverage: 15%
 *
 * Outputs:
 *   - HotspotScore with tier (A/B/C/D) and component scores
 *   - macro.hotspots[] array with counties where demand > 1.25 × supply
 */

import type {
  HotspotScore,
  MacroDemandResult,
  MacroSupplyResult,
  IndustrialSignals,
  HousingSignals,
  RvLakeSignals,
  RadiusCounty,
  AnalysisToggles,
} from '../../shared/OpportunityObject';
import { writeLog } from '../../shared/adapters/LovableAdapter';

// ============================================================================
// CONSTANTS
// ============================================================================

// Industry standard: 6 sqft storage demand per capita
const SQFT_PER_CAPITA = 6;

// Hotspot threshold: demand must exceed supply by 25%
const HOTSPOT_THRESHOLD = 1.25;

export interface HotspotScoringInput {
  population: number;
  macro_supply: MacroSupplyResult;
  industrial_signals: IndustrialSignals;
  housing_signals: HousingSignals;
  rv_lake_signals: RvLakeSignals;
  radius_counties: RadiusCounty[];
  toggles: AnalysisToggles;
  density?: number;
}

/**
 * Calculate industrial quick score
 * (Moved from pass1Calculators.ts)
 */
function calculateIndustrialScore(industrial: IndustrialSignals): number {
  let score = 0;

  // Distribution centers are key demand drivers
  score += Math.min(40, industrial.distribution_centers_nearby * 15);

  // Manufacturing presence
  if (industrial.manufacturing_presence === 'high') score += 35;
  else if (industrial.manufacturing_presence === 'moderate') score += 20;
  else score += 5;

  // Industrial momentum flag bonus
  if (industrial.industrial_momentum) score += 15;

  return Math.min(100, score);
}

/**
 * Calculate multifamily influence score
 * (Moved from pass1Calculators.ts)
 */
function calculateMultifamilyScore(housing: HousingSignals): number {
  const renterRate = 1 - (housing.home_ownership_rate || 0);
  let score = 0;

  if (renterRate > 0.5) {
    score = 80 + (renterRate - 0.5) * 40;
  } else if (renterRate > 0.3) {
    score = 50 + (renterRate - 0.3) * 150;
  } else {
    score = renterRate * 166;
  }

  // Bonus for higher rent areas (indicates transient population)
  if (housing.rent_median > 1500) score += 10;
  if (housing.rent_median > 2000) score += 10;

  return Math.min(100, Math.round(score));
}

/**
 * Calculate recreation/RV/lake proximity score
 * (Moved from pass1Calculators.ts)
 */
function calculateRecreationScore(rv: RvLakeSignals): number {
  let score = 0;

  if (rv.rv_potential === 'high') score += 40;
  else if (rv.rv_potential === 'moderate') score += 20;

  if (rv.lake_proximity) score += 25;
  if (rv.campground_nearby) score += 20;
  if (rv.recreation_load) score += 15;

  return Math.min(100, score);
}

/**
 * Compute hotspot score from all factors
 * (Moved from pass1Calculators.ts compilePass1Summary)
 */
export function computeHotspots(input: HotspotScoringInput): HotspotScore {
  const {
    population,
    macro_supply,
    industrial_signals,
    housing_signals,
    rv_lake_signals,
    radius_counties,
    toggles,
    density,
  } = input;

  // Calculate component scores
  const industrialScore = calculateIndustrialScore(industrial_signals);
  const multifamilyScore = calculateMultifamilyScore(housing_signals);
  const recreationScore = calculateRecreationScore(rv_lake_signals);
  const competitionScore = macro_supply.density_score;

  // Determine weights based on toggles
  const industrialWeight = toggles.industrial_momentum ? 20 : 15;
  const multifamilyWeight = toggles.multifamily_priority ? 20 : 15;
  const recreationWeight = toggles.recreation_load ? 15 : 10;

  let overall_score = 0;

  // Population factor (20% weight)
  let population_factor = 0;
  if (population > 50000) {
    population_factor = 100;
    overall_score += 20;
  } else if (population > 20000) {
    population_factor = 75;
    overall_score += 15;
  } else if (population > 10000) {
    population_factor = 50;
    overall_score += 10;
  } else {
    population_factor = 25;
    overall_score += 5;
  }

  // Competition density (25% weight)
  const competition_factor = competitionScore;
  overall_score += (competitionScore / 100) * 25;

  // Industrial factor
  const industrial_factor = industrialScore;
  overall_score += (industrialScore / 100) * industrialWeight;

  // Multifamily factor
  const multifamily_factor = multifamilyScore;
  overall_score += (multifamilyScore / 100) * multifamilyWeight;

  // Recreation factor
  const recreation_factor = recreationScore;
  overall_score += (recreationScore / 100) * recreationWeight;

  // Regional coverage (15% weight)
  if (radius_counties.length > 10) {
    overall_score += 15;
  } else if (radius_counties.length > 5) {
    overall_score += 10;
  } else {
    overall_score += 5;
  }

  // Urban exclusion penalty
  if (toggles.urban_exclude && density && density > 3000) {
    overall_score = Math.max(0, overall_score - 30);
  }

  overall_score = Math.round(Math.min(100, overall_score));

  // Determine tier
  let tier: 'A' | 'B' | 'C' | 'D';
  if (overall_score >= 75) tier = 'A';
  else if (overall_score >= 55) tier = 'B';
  else if (overall_score >= 35) tier = 'C';
  else tier = 'D';

  console.log(`[HOTSPOT_SCORING] Overall Score: ${overall_score}, Tier: ${tier}`);

  return {
    overall_score,
    population_factor,
    competition_factor,
    industrial_factor,
    multifamily_factor,
    recreation_factor,
    tier,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface HotspotScoringOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  hotspot_score: HotspotScore;
  hotspots: CountyHotspot[];
  error?: string;
}

export interface CountyHotspot {
  county: string;
  state: string;
  population: number;
  demand_sqft: number;
  estimated_supply_sqft: number;
  supply_gap_sqft: number;
  supply_ratio: number; // demand / supply
  is_hotspot: boolean;
  distance_miles?: number;
}

export interface CountySupplyEstimate {
  county: string;
  state: string;
  estimated_supply_sqft: number;
  competitor_count: number;
}

// ============================================================================
// COUNTY HOTSPOT DETECTION
// ============================================================================

/**
 * Identify county-level hotspots where demand > 1.25 × supply
 * This marks counties with significant undersupply
 *
 * @param radiusCounties - Counties within 120-mile radius
 * @param countySupply - Estimated supply by county (from competitors)
 * @returns Array of CountyHotspot with is_hotspot flag
 */
export function identifyCountyHotspots(
  radiusCounties: RadiusCounty[],
  countySupply: CountySupplyEstimate[] = []
): CountyHotspot[] {
  // Create lookup map for county supply
  const supplyMap = new Map<string, CountySupplyEstimate>();
  for (const cs of countySupply) {
    supplyMap.set(`${cs.county}|${cs.state}`, cs);
  }

  const hotspots: CountyHotspot[] = radiusCounties.map(county => {
    const key = `${county.county}|${county.state}`;
    const supply = supplyMap.get(key);

    // Calculate demand: population × 6 sqft
    const demand_sqft = county.population * SQFT_PER_CAPITA;

    // Estimate supply from competitor data, or use population-based estimate
    // Default: assume 5 sqft per capita if no data (slightly undersupplied baseline)
    const estimated_supply_sqft = supply?.estimated_supply_sqft ?? (county.population * 5);

    // Calculate supply ratio
    const supply_ratio = estimated_supply_sqft > 0
      ? demand_sqft / estimated_supply_sqft
      : 999; // Very high ratio if no supply

    // Identify hotspot: demand > 1.25 × supply
    const is_hotspot = supply_ratio >= HOTSPOT_THRESHOLD;

    return {
      county: county.county,
      state: county.state,
      population: county.population,
      demand_sqft,
      estimated_supply_sqft,
      supply_gap_sqft: demand_sqft - estimated_supply_sqft,
      supply_ratio: Math.round(supply_ratio * 100) / 100,
      is_hotspot,
      distance_miles: county.distance_miles,
    };
  });

  // Sort by supply ratio (highest undersupply first)
  hotspots.sort((a, b) => b.supply_ratio - a.supply_ratio);

  const hotspotCount = hotspots.filter(h => h.is_hotspot).length;
  console.log(`[HOTSPOT_SCORING] Identified ${hotspotCount}/${hotspots.length} county hotspots`);

  return hotspots;
}

/**
 * Run full hotspot analysis with status
 */
export async function runHotspotAnalysis(
  input: HotspotScoringInput,
  countySupply: CountySupplyEstimate[] = []
): Promise<HotspotScoringOutput> {
  try {
    const hotspot_score = computeHotspots(input);
    const hotspots = identifyCountyHotspots(input.radius_counties, countySupply);

    await writeLog('hotspot_analysis_complete', {
      overall_score: hotspot_score.overall_score,
      tier: hotspot_score.tier,
      county_count: input.radius_counties.length,
      hotspot_count: hotspots.filter(h => h.is_hotspot).length,
    });

    return {
      success: true,
      status: 'ok',
      hotspot_score,
      hotspots,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HOTSPOT_SCORING] Error:', error);

    return {
      success: false,
      status: 'error',
      hotspot_score: {
        overall_score: 0,
        population_factor: 0,
        competition_factor: 0,
        industrial_factor: 0,
        multifamily_factor: 0,
        recreation_factor: 0,
        tier: 'D',
      },
      hotspots: [],
      error: errorMessage,
    };
  }
}

/**
 * Get top hotspot counties (best opportunities)
 */
export function getTopHotspots(hotspots: CountyHotspot[], limit: number = 5): CountyHotspot[] {
  return hotspots
    .filter(h => h.is_hotspot)
    .slice(0, limit);
}

/**
 * Calculate aggregate hotspot metrics
 */
export function calculateHotspotMetrics(hotspots: CountyHotspot[]): {
  total_counties: number;
  hotspot_counties: number;
  hotspot_pct: number;
  total_supply_gap_sqft: number;
  avg_supply_ratio: number;
} {
  const hotspotCounties = hotspots.filter(h => h.is_hotspot);
  const total_supply_gap_sqft = hotspots.reduce((sum, h) => sum + Math.max(0, h.supply_gap_sqft), 0);
  const avg_supply_ratio = hotspots.length > 0
    ? hotspots.reduce((sum, h) => sum + h.supply_ratio, 0) / hotspots.length
    : 1;

  return {
    total_counties: hotspots.length,
    hotspot_counties: hotspotCounties.length,
    hotspot_pct: hotspots.length > 0 ? Math.round((hotspotCounties.length / hotspots.length) * 100) : 0,
    total_supply_gap_sqft,
    avg_supply_ratio: Math.round(avg_supply_ratio * 100) / 100,
  };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { SQFT_PER_CAPITA, HOTSPOT_THRESHOLD };
