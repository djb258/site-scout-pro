// =============================================================================
// JURISDICTION RESOLVER — Spoke SS.02.01
// =============================================================================
// Doctrine ID: SS.02.01
// Purpose: Resolve ZIP code to jurisdiction(s) for constraint lookup
//
// NO financial logic. NO cost estimates. Only jurisdiction resolution.
// =============================================================================

import type {
  JurisdictionResolverInput,
  JurisdictionResolverResult,
  JurisdictionInfo,
} from '../types/constraint_types';

/**
 * Resolve ZIP code to primary and overlapping jurisdictions.
 *
 * TODO: Implement actual resolution via:
 * - Geocoding API
 * - FIPS code lookup
 * - Census Bureau API
 */
export async function runJurisdictionResolver(
  input: JurisdictionResolverInput
): Promise<JurisdictionResolverResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.01] Resolving jurisdiction for ZIP: ${input.zip_code}`);

  // STUB: Return placeholder jurisdiction
  // In production, this would geocode and lookup actual jurisdiction data

  const primaryJurisdiction: JurisdictionInfo | null = input.state && input.county
    ? {
        jurisdiction_id: `J-${input.state}-${input.county.replace(/\s+/g, '-').toLowerCase()}`,
        jurisdiction_name: input.county,
        jurisdiction_type: 'county',
        state: input.state,
        county: input.county,
        fips_code: undefined,
      }
    : null;

  return {
    spoke_id: 'SS.02.01',
    status: primaryJurisdiction ? 'ok' : 'stub',
    timestamp,
    notes: primaryJurisdiction
      ? `Resolved to ${primaryJurisdiction.jurisdiction_name}, ${primaryJurisdiction.state}`
      : 'Jurisdiction resolution not implemented. Requires state/county input or geocoding.',
    primary_jurisdiction: primaryJurisdiction,
    overlapping_jurisdictions: [],
    resolution_method: primaryJurisdiction ? 'manual' : 'unknown',
  };
}
