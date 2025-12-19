/**
 * ZipHydration.ts - Pass-1 Spoke
 * Doctrine ID: SS.01.01
 * Purpose: Hydrate ZIP code with geographic and demographic data
 *
 * ============================================================================
 * DATA SOURCES
 * ============================================================================
 *
 * This spoke queries:
 * - ref_zip_replica: ZIP code geographic data (lat, lon, state_id)
 * - ref_state_replica: State information (state_code, state_name)
 * - ref_county_replica: County information for ZIP-to-county mapping
 *
 * ============================================================================
 */

import { getSupabase } from '../../../shared/data_layer/ConnectionFactory';

// ============================================================================
// TYPES
// ============================================================================

export interface ZipHydrationInput {
  zip: string;
  state: string;
}

export interface ZipHydrationOutput {
  spokeId: 'SS.01.01';
  status: 'ok' | 'partial' | 'error';

  // Geographic
  zipCode: string;
  city: string | null;
  county: string | null;
  countyFips: string | null;
  state: string;
  stateName: string | null;

  // Coordinates
  latitude: number;
  longitude: number;

  // Demographics (from Census - may be null if not yet hydrated)
  population: number | null;
  medianIncome: number | null;
  householdCount: number | null;

  // Metadata
  timestamp: string;
  dataSource: 'supabase' | 'census_api' | 'fallback';
  errors: string[];
}

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Run ZIP code hydration.
 * Queries Supabase reference tables for geographic data.
 */
export async function runZipHydration(input: ZipHydrationInput): Promise<ZipHydrationOutput> {
  console.log('[ZIP_HYDRATION] Running for', input.zip);
  const errors: string[] = [];

  const output: ZipHydrationOutput = {
    spokeId: 'SS.01.01',
    status: 'ok',
    zipCode: input.zip,
    city: null,
    county: null,
    countyFips: null,
    state: input.state,
    stateName: null,
    latitude: 0,
    longitude: 0,
    population: null,
    medianIncome: null,
    householdCount: null,
    timestamp: new Date().toISOString(),
    dataSource: 'fallback',
    errors: [],
  };

  try {
    const supabase = getSupabase();

    // Step 1: Query ZIP code geographic data
    const { data: zipData, error: zipError } = await supabase
      .from('ref_zip_replica')
      .select('zip_id, state_id, lat, lon, city, county_fips')
      .eq('zip_id', input.zip)
      .maybeSingle();

    if (zipError) {
      console.error('[ZIP_HYDRATION] Error fetching ZIP:', zipError.message);
      errors.push(`ZIP lookup failed: ${zipError.message}`);
    }

    if (zipData) {
      output.latitude = zipData.lat ?? 0;
      output.longitude = zipData.lon ?? 0;
      output.city = zipData.city ?? null;
      output.countyFips = zipData.county_fips ?? null;
      output.dataSource = 'supabase';

      // Step 2: Query state information
      if (zipData.state_id) {
        const { data: stateData, error: stateError } = await supabase
          .from('ref_state_replica')
          .select('state_code, state_name')
          .eq('state_id', zipData.state_id)
          .maybeSingle();

        if (stateError) {
          console.error('[ZIP_HYDRATION] Error fetching state:', stateError.message);
          errors.push(`State lookup failed: ${stateError.message}`);
        }

        if (stateData) {
          output.state = stateData.state_code ?? input.state;
          output.stateName = stateData.state_name ?? null;
        }
      }

      // Step 3: Query county information if we have county_fips
      if (zipData.county_fips) {
        const { data: countyData, error: countyError } = await supabase
          .from('ref_county_replica')
          .select('county_name, county_fips')
          .eq('county_fips', zipData.county_fips)
          .maybeSingle();

        if (countyError) {
          console.error('[ZIP_HYDRATION] Error fetching county:', countyError.message);
          errors.push(`County lookup failed: ${countyError.message}`);
        }

        if (countyData) {
          output.county = countyData.county_name ?? null;
        }
      }

      // Step 4: Check for cached Census data
      const { data: censusData, error: censusError } = await supabase
        .from('ref_pass1_census_snapshots')
        .select('population, median_income, household_count')
        .eq('zip_code', input.zip)
        .maybeSingle();

      if (!censusError && censusData) {
        output.population = censusData.population ?? null;
        output.medianIncome = censusData.median_income ?? null;
        output.householdCount = censusData.household_count ?? null;
      }

    } else {
      // ZIP not found in reference data
      errors.push(`ZIP code ${input.zip} not found in reference data`);
      output.status = 'partial';
    }

  } catch (error) {
    console.error('[ZIP_HYDRATION] Unexpected error:', error);
    errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
    output.status = 'error';
  }

  // Set final status based on data completeness
  if (errors.length > 0) {
    output.status = output.latitude !== 0 ? 'partial' : 'error';
  }

  output.errors = errors;

  console.log('[ZIP_HYDRATION] Complete:', {
    zip: output.zipCode,
    status: output.status,
    hasCoords: output.latitude !== 0,
    hasCounty: !!output.county,
  });

  return output;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Hydrate multiple ZIP codes in batch.
 */
export async function runZipHydrationBatch(
  inputs: ZipHydrationInput[]
): Promise<ZipHydrationOutput[]> {
  console.log(`[ZIP_HYDRATION] Batch processing ${inputs.length} ZIP codes`);

  const results: ZipHydrationOutput[] = [];

  for (const input of inputs) {
    const result = await runZipHydration(input);
    results.push(result);
  }

  return results;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick lookup for ZIP coordinates only.
 */
export async function getZipCoordinates(
  zip: string
): Promise<{ lat: number; lon: number } | null> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('ref_zip_replica')
      .select('lat, lon')
      .eq('zip_id', zip)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      lat: data.lat ?? 0,
      lon: data.lon ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get county for a ZIP code.
 */
export async function getZipCounty(
  zip: string
): Promise<{ countyName: string; countyFips: string } | null> {
  try {
    const supabase = getSupabase();

    const { data: zipData, error: zipError } = await supabase
      .from('ref_zip_replica')
      .select('county_fips')
      .eq('zip_id', zip)
      .maybeSingle();

    if (zipError || !zipData?.county_fips) {
      return null;
    }

    const { data: countyData, error: countyError } = await supabase
      .from('ref_county_replica')
      .select('county_name, county_fips')
      .eq('county_fips', zipData.county_fips)
      .maybeSingle();

    if (countyError || !countyData) {
      return null;
    }

    return {
      countyName: countyData.county_name,
      countyFips: countyData.county_fips,
    };
  } catch {
    return null;
  }
}
