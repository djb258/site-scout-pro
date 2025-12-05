/**
 * ZIP HYDRATION SPOKE
 *
 * Responsibility: Fetch and hydrate ZIP code metadata from reference data
 *
 * Inputs:
 *   - zip: string (5-digit ZIP code)
 *
 * Outputs:
 *   - ZipMetadata object with demographics, location, income data
 *   - IdentityBlock with location identifiers
 *
 * Data Sources:
 *   - Lovable.DB: zip_master table (synced from Neon)
 */

import type { ZipMetadata, IdentityBlock } from '../../../shared/opportunity_object';
import { db, queryData, writeLog, writeErrorLog } from '../../../shared/lovable_adapter';

// ============================================================================
// TYPES
// ============================================================================

export interface HydrationInput {
  zip: string;
}

export interface HydrationOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  zip_metadata: ZipMetadata | null;
  identity: IdentityBlock | null;
  error?: string;
}

/**
 * Raw ZIP record from zip_master table
 */
interface ZipMasterRecord {
  zip: string;
  city: string;
  county: string;
  state_id: string;
  state_name: string;
  lat: number;
  lng: number;
  population: number;
  density: number;
  income_household_median: number;
  home_value: number;
  home_ownership: number;
  rent_median: number;
  age_median: number;
  county_fips?: string;
  education_college_or_above?: number;
  unemployment_rate?: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Hydrate ZIP code with full metadata from Lovable.DB
 *
 * @param input - Contains the 5-digit ZIP code
 * @returns HydrationOutput with zip_metadata and identity blocks
 */
export async function hydrateZip(input: HydrationInput): Promise<HydrationOutput> {
  console.log(`[ZIP_HYDRATION] Hydrating ZIP: ${input.zip}`);

  // Validate ZIP format
  if (!validateZip(input.zip)) {
    await writeErrorLog('zip_hydration_invalid', 'Invalid ZIP format', { zip: input.zip });
    return {
      success: false,
      status: 'error',
      zip_metadata: null,
      identity: null,
      error: 'Invalid ZIP code format. Must be 5 digits.',
    };
  }

  try {
    // Query zip_master table from Lovable.DB
    const records = await queryData<ZipMasterRecord>('zip_master', { zip: input.zip });

    if (!records || records.length === 0) {
      console.warn(`[ZIP_HYDRATION] ZIP not found in zip_master: ${input.zip}`);
      await writeLog('zip_hydration_not_found', { zip: input.zip });

      return {
        success: false,
        status: 'error',
        zip_metadata: null,
        identity: null,
        error: `ZIP code ${input.zip} not found in database`,
      };
    }

    const record = records[0];

    // Build ZipMetadata object
    const zip_metadata: ZipMetadata = {
      zip: record.zip,
      city: record.city,
      county: record.county,
      state_id: record.state_id,
      state_name: record.state_name,
      lat: record.lat,
      lng: record.lng,
      population: record.population,
      density: record.density,
      income_household_median: record.income_household_median,
      home_value: record.home_value,
      home_ownership: record.home_ownership,
      rent_median: record.rent_median,
      age_median: record.age_median,
      education_college_or_above: record.education_college_or_above,
      unemployment_rate: record.unemployment_rate,
    };

    // Build IdentityBlock
    const identity: IdentityBlock = {
      zip: record.zip,
      city: record.city,
      county: record.county,
      state: record.state_name,
      state_id: record.state_id,
      lat: record.lat,
      lng: record.lng,
      county_fips: record.county_fips,
    };

    await writeLog('zip_hydration_success', {
      zip: input.zip,
      city: record.city,
      county: record.county,
      state: record.state_id,
      population: record.population,
    });

    console.log(`[ZIP_HYDRATION] Success: ${record.city}, ${record.county}, ${record.state_id} (pop: ${record.population?.toLocaleString()})`);

    return {
      success: true,
      status: 'ok',
      zip_metadata,
      identity,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ZIP_HYDRATION] Error:`, error);
    await writeErrorLog('zip_hydration_error', error instanceof Error ? error : errorMessage, { zip: input.zip });

    return {
      success: false,
      status: 'error',
      zip_metadata: null,
      identity: null,
      error: errorMessage,
    };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate ZIP code format (5 digits)
 */
export function validateZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

/**
 * Normalize ZIP code (remove leading zeros if needed, pad to 5 digits)
 */
export function normalizeZip(zip: string): string {
  const cleaned = zip.replace(/\D/g, '');
  return cleaned.padStart(5, '0').slice(0, 5);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { ZipMasterRecord };
