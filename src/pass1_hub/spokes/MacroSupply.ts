/**
 * MACRO SUPPLY SPOKE
 *
 * Responsibility: Calculate existing storage supply (competitor analysis)
 *
 * Inputs:
 *   - lat: number (center latitude)
 *   - lng: number (center longitude)
 *   - radius_miles: number (search radius)
 *
 * Outputs:
 *   - MacroSupplyResult with competitor count, total sqft, density score
 *   - Add to OpportunityObject: macro.supply block
 *
 * Data Sources:
 *   - Lovable.DB: competitors_scratchpad table (synced from Google Places/Neon)
 */

import type { Competitor, MacroSupplyResult } from '../../shared/OpportunityObject';
import { queryData, writeLog, writeErrorLog } from '../../shared/adapters/LovableAdapter';
import { calculateDistanceMiles } from './RadiusBuilder';

// ============================================================================
// TYPES
// ============================================================================

export interface MacroSupplyInput {
  competitors: Competitor[];
}

export interface MacroSupplyOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  supply: MacroSupplyResult;
  competitors: Competitor[];
  error?: string;
}

/**
 * Raw competitor record from competitors_scratchpad table
 */
interface CompetitorRecord {
  id?: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  estimated_sqft?: number;
  climate_controlled?: boolean;
  rating?: number;
  review_count?: number;
  phone?: string;
  website?: string;
  source?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate competitor density score
 * Score: 0-100, where LOWER competition = HIGHER score (better)
 *
 * @param input - Contains array of competitors
 * @returns MacroSupplyResult with density calculations
 */
export function runMacroSupply(input: MacroSupplyInput): MacroSupplyResult {
  const { competitors } = input;

  const totalSqft = competitors.reduce((sum, c) => sum + (c.estimated_sqft || 0), 0);
  const avgDistance =
    competitors.length > 0
      ? competitors.reduce((sum, c) => sum + (c.distance_miles || 0), 0) / competitors.length
      : 0;

  // Density score calculation
  // Fewer competitors + further away = higher score (better)
  // 0-3 competitors within 5mi = low density (score 80-100)
  // 4-6 competitors = moderate (score 50-79)
  // 7+ competitors = high density (score 0-49)
  let densityScore = 100;

  if (competitors.length >= 7) {
    densityScore = Math.max(0, 50 - (competitors.length - 7) * 5);
  } else if (competitors.length >= 4) {
    densityScore = 80 - (competitors.length - 4) * 10;
  } else {
    densityScore = 100 - competitors.length * 7;
  }

  // Adjust for average distance (closer = worse)
  if (avgDistance < 3) densityScore -= 15;
  else if (avgDistance < 5) densityScore -= 5;
  else if (avgDistance > 10) densityScore += 10;

  densityScore = Math.max(0, Math.min(100, densityScore));

  console.log(`[MACRO_SUPPLY] Competitors: ${competitors.length}, Total: ${totalSqft.toLocaleString()} sqft, Density Score: ${densityScore}`);

  return {
    competitor_count: competitors.length,
    total_supply_sqft: totalSqft,
    avg_distance_miles: Math.round(avgDistance * 10) / 10,
    density_score: densityScore,
  };
}

/**
 * Fetch competitors from Lovable.DB scratchpad within radius
 *
 * @param lat - Center latitude
 * @param lng - Center longitude
 * @param radiusMiles - Search radius in miles
 * @returns Array of Competitor objects with distances
 */
export async function fetchCompetitors(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<Competitor[]> {
  console.log(`[MACRO_SUPPLY] Fetching competitors within ${radiusMiles}mi of (${lat}, ${lng})`);

  try {
    // Query competitors from scratchpad table
    const allCompetitors = await queryData<CompetitorRecord>('competitors_scratchpad');

    if (!allCompetitors || allCompetitors.length === 0) {
      console.warn('[MACRO_SUPPLY] No competitors found in scratchpad');
      await writeLog('macro_supply_no_data', { lat, lng, radius: radiusMiles });
      return [];
    }

    // Calculate distance and filter by radius
    const competitorsWithDistance = allCompetitors
      .map(c => ({
        name: c.name,
        address: c.address,
        distance_miles: calculateDistanceMiles(lat, lng, c.lat, c.lng),
        estimated_sqft: c.estimated_sqft || estimateSqftFromReviews(c.review_count),
        climate_controlled: c.climate_controlled,
        rating: c.rating,
        review_count: c.review_count,
      }))
      .filter(c => c.distance_miles <= radiusMiles)
      .sort((a, b) => a.distance_miles - b.distance_miles);

    // Round distances
    const competitors: Competitor[] = competitorsWithDistance.map(c => ({
      ...c,
      distance_miles: Math.round(c.distance_miles * 10) / 10,
    }));

    await writeLog('macro_supply_fetched', {
      lat,
      lng,
      radius: radiusMiles,
      found: competitors.length,
      total_sqft: competitors.reduce((sum, c) => sum + (c.estimated_sqft || 0), 0),
    });

    console.log(`[MACRO_SUPPLY] Found ${competitors.length} competitors within ${radiusMiles}mi`);
    return competitors;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MACRO_SUPPLY] Error fetching competitors:', error);
    await writeErrorLog('macro_supply_error', error instanceof Error ? error : errorMessage, {
      lat,
      lng,
      radius: radiusMiles,
    });
    return [];
  }
}

/**
 * Run full macro supply analysis with status
 */
export async function runMacroSupplyWithStatus(
  lat: number,
  lng: number,
  radiusMiles: number = 10
): Promise<MacroSupplyOutput> {
  try {
    const competitors = await fetchCompetitors(lat, lng, radiusMiles);
    const supply = runMacroSupply({ competitors });

    return {
      success: true,
      status: competitors.length > 0 ? 'ok' : 'stub',
      supply,
      competitors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      status: 'error',
      supply: {
        competitor_count: 0,
        total_supply_sqft: 0,
        avg_distance_miles: 0,
        density_score: 100,
      },
      competitors: [],
      error: errorMessage,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimate facility square footage from review count
 * Heuristic: More reviews typically = larger facility
 */
function estimateSqftFromReviews(reviewCount?: number): number {
  if (!reviewCount) return 30000; // Default estimate

  if (reviewCount > 200) return 80000;
  if (reviewCount > 100) return 60000;
  if (reviewCount > 50) return 45000;
  if (reviewCount > 20) return 35000;
  return 25000;
}

/**
 * Calculate supply per capita for a given population
 */
export function calculateSupplyPerCapita(supply: MacroSupplyResult, population: number): number {
  if (population === 0) return 0;
  return Math.round((supply.total_supply_sqft / population) * 100) / 100;
}

/**
 * Determine market saturation level
 * Industry standard: ~6 sqft per capita is equilibrium
 */
export function determineMarketSaturation(
  supplyPerCapita: number
): 'undersupplied' | 'balanced' | 'oversupplied' {
  if (supplyPerCapita < 5) return 'undersupplied';
  if (supplyPerCapita > 8) return 'oversupplied';
  return 'balanced';
}

/**
 * Calculate supply-demand gap
 */
export function calculateSupplyDemandGap(
  totalSupplySqft: number,
  totalDemandSqft: number
): {
  gap_sqft: number;
  gap_pct: number;
  status: 'surplus' | 'deficit' | 'balanced';
} {
  const gap_sqft = totalDemandSqft - totalSupplySqft;
  const gap_pct = totalDemandSqft > 0 ? Math.round((gap_sqft / totalDemandSqft) * 100) : 0;

  let status: 'surplus' | 'deficit' | 'balanced';
  if (gap_pct > 10) status = 'deficit';
  else if (gap_pct < -10) status = 'surplus';
  else status = 'balanced';

  return { gap_sqft, gap_pct, status };
}
