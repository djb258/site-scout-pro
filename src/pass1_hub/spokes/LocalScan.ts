/**
 * LOCAL SCAN SPOKE
 *
 * Responsibility: Detailed competitor analysis within configurable radius (5-30 miles)
 * Triggered by user via radius slider in UI
 *
 * Inputs:
 *   - lat: number
 *   - lng: number
 *   - radius_miles: number (5-30, from slider)
 *   - include_pricing: boolean
 *
 * Outputs:
 *   - LocalScanResults with detailed competitor list
 *   - localScan.zips[] - ZIPs within radius
 *   - localScan.competitors[] - Competitor facilities
 *
 * Data Sources:
 *   - Lovable.DB: competitors_scratchpad, zip_master tables
 */

import type {
  LocalScanConfig,
  LocalScanResults,
  LocalCompetitor,
  CallSheetEntry,
} from '../../shared/OpportunityObject';
import { queryData, writeLog, writeErrorLog } from '../../shared/adapters/LovableAdapter';
import { calculateDistanceMiles } from './RadiusBuilder';

// ============================================================================
// TYPES
// ============================================================================

export interface LocalScanInput {
  lat: number;
  lng: number;
  radius_miles: number;
  include_pricing?: boolean;
  generate_call_sheet?: boolean;
}

export interface LocalScanOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  results: LocalScanResults;
  zips_in_radius: string[];
  error?: string;
}

/**
 * Raw competitor record from competitors_scratchpad table
 */
interface CompetitorRecord {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  estimated_sqft?: number;
  climate_controlled?: boolean;
  rating?: number;
  review_count?: number;
  pricing_verified?: boolean;
  last_pricing_date?: string;
  rates?: {
    '5x5'?: number;
    '5x10'?: number;
    '10x10'?: number;
    '10x15'?: number;
    '10x20'?: number;
    '10x30'?: number;
  };
}

/**
 * ZIP record for local scan
 */
interface ZipRecord {
  zip: string;
  city: string;
  state_id: string;
  lat: number;
  lng: number;
  population: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Run local competitor scan
 * Fetches competitors and ZIPs within the specified radius
 *
 * @param input - Contains lat, lng, radius_miles, and options
 * @returns LocalScanOutput with competitors and ZIPs in radius
 */
export async function runLocalScan(input: LocalScanInput): Promise<LocalScanResults> {
  const config: LocalScanConfig = {
    radius_miles: input.radius_miles,
    include_pricing: input.include_pricing ?? true,
    generate_call_sheet: input.generate_call_sheet ?? true,
  };

  console.log(`[LOCAL_SCAN] Scanning ${config.radius_miles}mi radius from (${input.lat}, ${input.lng})`);

  try {
    // Fetch competitors from scratchpad
    const local_competitors = await fetchLocalCompetitors(
      input.lat,
      input.lng,
      input.radius_miles
    );

    // Generate call sheet for facilities needing pricing
    let call_sheet: CallSheetEntry[] = [];
    if (config.generate_call_sheet) {
      call_sheet = generateCallSheet(local_competitors);
    }

    // Calculate pricing readiness
    const pricing_readiness = checkPricingReadiness(local_competitors);

    await writeLog('local_scan_complete', {
      lat: input.lat,
      lng: input.lng,
      radius_miles: input.radius_miles,
      competitors_found: local_competitors.length,
      pricing_verified: pricing_readiness.pricing_verified,
      pricing_needed: pricing_readiness.pricing_needed,
    });

    console.log(`[LOCAL_SCAN] Found ${local_competitors.length} competitors, ${pricing_readiness.pricing_verified} with pricing`);

    return {
      config,
      local_competitors,
      call_sheet,
      pricing_readiness,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LOCAL_SCAN] Error:', error);
    await writeErrorLog('local_scan_error', error instanceof Error ? error : errorMessage, {
      lat: input.lat,
      lng: input.lng,
      radius_miles: input.radius_miles,
    });

    return {
      config,
      local_competitors: [],
      call_sheet: [],
      pricing_readiness: {
        total_facilities: 0,
        pricing_verified: 0,
        pricing_needed: 0,
        readiness_pct: 0,
      },
    };
  }
}

/**
 * Run local scan with full output wrapper (includes status)
 */
export async function runLocalScanWithStatus(input: LocalScanInput): Promise<LocalScanOutput> {
  try {
    const results = await runLocalScan(input);
    const zips_in_radius = await fetchZipsInRadius(input.lat, input.lng, input.radius_miles);

    return {
      success: true,
      status: results.local_competitors.length > 0 ? 'ok' : 'stub',
      results,
      zips_in_radius,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      status: 'error',
      results: {
        config: {
          radius_miles: input.radius_miles,
          include_pricing: true,
          generate_call_sheet: true,
        },
        local_competitors: [],
        call_sheet: [],
        pricing_readiness: {
          total_facilities: 0,
          pricing_verified: 0,
          pricing_needed: 0,
          readiness_pct: 0,
        },
      },
      zips_in_radius: [],
      error: errorMessage,
    };
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch local competitors from Lovable.DB scratchpad
 */
async function fetchLocalCompetitors(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<LocalCompetitor[]> {
  const allCompetitors = await queryData<CompetitorRecord>('competitors_scratchpad');

  if (!allCompetitors || allCompetitors.length === 0) {
    console.warn('[LOCAL_SCAN] No competitors found in scratchpad');
    return [];
  }

  // Calculate distance and filter by radius
  const competitorsWithDistance = allCompetitors
    .map(c => ({
      name: c.name,
      address: c.address,
      phone: c.phone,
      website: c.website,
      distance_miles: calculateDistanceMiles(lat, lng, c.lat, c.lng),
      estimated_sqft: c.estimated_sqft || estimateSqftFromReviews(c.review_count),
      climate_controlled: c.climate_controlled,
      rating: c.rating,
      review_count: c.review_count,
      pricing_verified: c.pricing_verified || false,
      last_pricing_date: c.last_pricing_date,
      rates: c.rates,
    }))
    .filter(c => c.distance_miles <= radiusMiles)
    .sort((a, b) => a.distance_miles - b.distance_miles);

  // Round distances and ensure LocalCompetitor type
  const competitors: LocalCompetitor[] = competitorsWithDistance.map(c => ({
    ...c,
    distance_miles: Math.round(c.distance_miles * 10) / 10,
  }));

  return competitors;
}

/**
 * Fetch ZIPs within radius from Lovable.DB
 */
async function fetchZipsInRadius(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<string[]> {
  const allZips = await queryData<ZipRecord>('zip_master');

  if (!allZips || allZips.length === 0) {
    return [];
  }

  // Calculate distance and filter
  const zipsInRadius = allZips
    .filter(z => calculateDistanceMiles(lat, lng, z.lat, z.lng) <= radiusMiles)
    .map(z => z.zip);

  console.log(`[LOCAL_SCAN] Found ${zipsInRadius.length} ZIPs within ${radiusMiles}mi`);
  return zipsInRadius;
}

// ============================================================================
// CALL SHEET GENERATION
// ============================================================================

/**
 * Generate call sheet from competitors needing pricing verification
 */
export function generateCallSheet(competitors: LocalCompetitor[]): CallSheetEntry[] {
  const needPricing = competitors.filter((c) => !c.pricing_verified);

  return needPricing.map((c) => ({
    facility_name: c.name,
    phone: c.phone || 'LOOKUP_NEEDED',
    address: c.address || '',
    distance_miles: c.distance_miles,
    notes: `Est. ${c.estimated_sqft?.toLocaleString() || 'unknown'} sqft`,
    pricing_needed: true,
    call_status: 'pending' as const,
  }));
}

// ============================================================================
// PRICING READINESS
// ============================================================================

/**
 * Check pricing readiness for Pass 2
 */
export function checkPricingReadiness(competitors: LocalCompetitor[]): {
  total_facilities: number;
  pricing_verified: number;
  pricing_needed: number;
  readiness_pct: number;
  ready_for_pass2: boolean;
} {
  const total = competitors.length;
  const verified = competitors.filter((c) => c.pricing_verified).length;
  const needed = total - verified;
  const readiness_pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  // Need at least 50% pricing data to proceed to Pass 2
  const ready_for_pass2 = readiness_pct >= 50;

  return {
    total_facilities: total,
    pricing_verified: verified,
    pricing_needed: needed,
    readiness_pct,
    ready_for_pass2,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimate facility square footage from review count
 */
function estimateSqftFromReviews(reviewCount?: number): number {
  if (!reviewCount) return 30000;

  if (reviewCount > 200) return 80000;
  if (reviewCount > 100) return 60000;
  if (reviewCount > 50) return 45000;
  if (reviewCount > 20) return 35000;
  return 25000;
}

/**
 * Get competitors with missing pricing data
 */
export function getCompetitorsNeedingPricing(competitors: LocalCompetitor[]): LocalCompetitor[] {
  return competitors.filter(c => !c.pricing_verified);
}

/**
 * Get competitors with verified pricing
 */
export function getCompetitorsWithPricing(competitors: LocalCompetitor[]): LocalCompetitor[] {
  return competitors.filter(c => c.pricing_verified);
}

/**
 * Calculate average rates from verified competitors
 */
export function calculateAverageRates(competitors: LocalCompetitor[]): Record<string, number> {
  const withRates = competitors.filter(c => c.pricing_verified && c.rates);

  if (withRates.length === 0) {
    return {};
  }

  const rateSums: Record<string, { sum: number; count: number }> = {};

  for (const comp of withRates) {
    if (!comp.rates) continue;

    for (const [size, rate] of Object.entries(comp.rates)) {
      if (rate !== undefined && rate > 0) {
        if (!rateSums[size]) {
          rateSums[size] = { sum: 0, count: 0 };
        }
        rateSums[size].sum += rate;
        rateSums[size].count += 1;
      }
    }
  }

  const averages: Record<string, number> = {};
  for (const [size, data] of Object.entries(rateSums)) {
    averages[size] = Math.round(data.sum / data.count);
  }

  return averages;
}
