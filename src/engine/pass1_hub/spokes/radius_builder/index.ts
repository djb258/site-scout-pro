/**
 * RADIUS BUILDER SPOKE (120-Mile Regional Radius)
 *
 * Responsibility: Build list of counties within 120-mile radius of target ZIP
 *
 * Inputs:
 *   - lat: number (ZIP centroid latitude)
 *   - lng: number (ZIP centroid longitude)
 *   - radius_miles: number (default 120)
 *
 * Outputs:
 *   - Array of RadiusCounty objects with population data
 *   - macro.radius120 block for OpportunityObject
 *
 * Data Sources:
 *   - Lovable.DB: zip_master table (grouped by county)
 */

import type { RadiusCounty } from '../../../shared/opportunity_object';
import { queryData, writeLog, writeErrorLog } from '../../../shared/lovable_adapter';

// ============================================================================
// TYPES
// ============================================================================

export interface RadiusBuilderInput {
  lat: number;
  lng: number;
  state_id: string;
  radius_miles?: number; // Default 120
}

export interface RadiusBuilderOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  radius_counties: RadiusCounty[];
  total_population: number;
  county_count: number;
  error?: string;
}

/**
 * Raw ZIP record from zip_master table (minimal fields needed for radius calc)
 */
interface ZipForRadius {
  zip: string;
  county: string;
  state_id: string;
  lat: number;
  lng: number;
  population: number;
}

/**
 * Intermediate county aggregation
 */
interface CountyAggregate {
  county: string;
  state: string;
  population: number;
  zip_count: number;
  center_lat: number;
  center_lng: number;
  min_distance: number;
}

// ============================================================================
// HAVERSINE DISTANCE CALCULATION
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bounding box for initial filtering (optimization)
 * Returns rough lat/lng bounds that encompass the radius
 */
function calculateBoundingBox(lat: number, lng: number, radiusMiles: number): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  // 1 degree latitude ≈ 69 miles
  // 1 degree longitude ≈ 69 * cos(latitude) miles
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Build 120-mile radius county list
 * Uses Haversine distance to find all ZIPs within radius, then aggregates by county
 *
 * @param input - Contains lat, lng, state_id, and optional radius_miles
 * @returns RadiusBuilderOutput with counties and population totals
 */
export async function buildRadius120(input: RadiusBuilderInput): Promise<RadiusBuilderOutput> {
  const radiusMiles = input.radius_miles ?? 120;

  console.log(`[RADIUS_BUILDER] Building ${radiusMiles}-mile radius from (${input.lat}, ${input.lng})`);

  // Validate input coordinates
  if (!input.lat || !input.lng || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    await writeErrorLog('radius_builder_invalid_coords', 'Invalid coordinates', { lat: input.lat, lng: input.lng });
    return {
      success: false,
      status: 'error',
      radius_counties: [],
      total_population: 0,
      county_count: 0,
      error: 'Invalid coordinates provided',
    };
  }

  try {
    // Query all ZIPs from zip_master
    // Note: In production, Lovable.DB would support spatial queries
    // For now, we fetch all and filter client-side using Haversine
    const allZips = await queryData<ZipForRadius>('zip_master');

    if (!allZips || allZips.length === 0) {
      console.warn('[RADIUS_BUILDER] No ZIPs found in zip_master table');
      return {
        success: false,
        status: 'error',
        radius_counties: [],
        total_population: 0,
        county_count: 0,
        error: 'No ZIP data available in database',
      };
    }

    // Calculate bounding box for initial rough filtering (optimization)
    const bbox = calculateBoundingBox(input.lat, input.lng, radiusMiles);

    // Filter ZIPs within bounding box first (rough filter)
    const roughFilteredZips = allZips.filter(z =>
      z.lat >= bbox.minLat &&
      z.lat <= bbox.maxLat &&
      z.lng >= bbox.minLng &&
      z.lng <= bbox.maxLng
    );

    console.log(`[RADIUS_BUILDER] Rough filter: ${roughFilteredZips.length}/${allZips.length} ZIPs in bounding box`);

    // Calculate precise Haversine distance and filter
    const zipsWithDistance = roughFilteredZips
      .map(z => ({
        ...z,
        distance: calculateDistanceMiles(input.lat, input.lng, z.lat, z.lng),
      }))
      .filter(z => z.distance <= radiusMiles);

    console.log(`[RADIUS_BUILDER] Precise filter: ${zipsWithDistance.length} ZIPs within ${radiusMiles}mi`);

    // Aggregate by county
    const countyMap = new Map<string, CountyAggregate>();

    for (const zip of zipsWithDistance) {
      const key = `${zip.county}|${zip.state_id}`;

      if (countyMap.has(key)) {
        const existing = countyMap.get(key)!;
        existing.population += zip.population || 0;
        existing.zip_count += 1;
        // Track minimum distance (closest ZIP in that county)
        existing.min_distance = Math.min(existing.min_distance, zip.distance);
        // Update center (simple average)
        existing.center_lat = (existing.center_lat * (existing.zip_count - 1) + zip.lat) / existing.zip_count;
        existing.center_lng = (existing.center_lng * (existing.zip_count - 1) + zip.lng) / existing.zip_count;
      } else {
        countyMap.set(key, {
          county: zip.county,
          state: zip.state_id,
          population: zip.population || 0,
          zip_count: 1,
          center_lat: zip.lat,
          center_lng: zip.lng,
          min_distance: zip.distance,
        });
      }
    }

    // Convert to RadiusCounty array and sort by distance
    const radius_counties: RadiusCounty[] = Array.from(countyMap.values())
      .map(c => ({
        county: c.county,
        state: c.state,
        population: c.population,
        distance_miles: Math.round(c.min_distance * 10) / 10,
      }))
      .sort((a, b) => (a.distance_miles || 0) - (b.distance_miles || 0));

    // Calculate totals
    const total_population = radius_counties.reduce((sum, c) => sum + c.population, 0);

    await writeLog('radius_builder_success', {
      lat: input.lat,
      lng: input.lng,
      radius_miles: radiusMiles,
      county_count: radius_counties.length,
      total_population,
      zip_count: zipsWithDistance.length,
    });

    console.log(`[RADIUS_BUILDER] Found ${radius_counties.length} counties, ${total_population.toLocaleString()} total population`);

    return {
      success: true,
      status: 'ok',
      radius_counties,
      total_population,
      county_count: radius_counties.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RADIUS_BUILDER] Error:', error);
    await writeErrorLog('radius_builder_error', error instanceof Error ? error : errorMessage, {
      lat: input.lat,
      lng: input.lng,
      radius_miles: radiusMiles,
    });

    return {
      success: false,
      status: 'error',
      radius_counties: [],
      total_population: 0,
      county_count: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Enumerate counties from existing Pass1 data
 * (Moved from pass1Calculators.ts)
 */
export function calculateRadiusEnumeration(radiusCounties: RadiusCounty[]): {
  totalCounties: number;
  totalPopulation: number;
  avgPopulation: number;
  counties: string[];
} {
  const totalPopulation = radiusCounties.reduce((sum, c) => sum + (c.population || 0), 0);

  return {
    totalCounties: radiusCounties.length,
    totalPopulation,
    avgPopulation: radiusCounties.length > 0 ? Math.round(totalPopulation / radiusCounties.length) : 0,
    counties: radiusCounties.map((c) => c.county).filter(Boolean),
  };
}

/**
 * Get counties sorted by population (for identifying major markets)
 */
export function getTopCountiesByPopulation(radiusCounties: RadiusCounty[], limit: number = 10): RadiusCounty[] {
  return [...radiusCounties]
    .sort((a, b) => b.population - a.population)
    .slice(0, limit);
}

/**
 * Calculate distance from center to a specific county
 */
export function getCountyDistance(
  centerLat: number,
  centerLng: number,
  county: RadiusCounty
): number {
  return county.distance_miles || 0;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { CountyAggregate };
