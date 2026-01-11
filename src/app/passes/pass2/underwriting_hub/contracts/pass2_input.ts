// =============================================================================
// PASS 2 INPUT CONTRACT — Strict Interface
// =============================================================================
// Doctrine ID: SS.02.00.IN
// Purpose: Define the ONLY acceptable inputs to Pass 2 Constraint Compiler
//
// DOCTRINE: Pass 2 receives a ZIP + asset class and compiles constraints.
// No financial data, no revenue assumptions, no market data.
// =============================================================================

/**
 * Asset classes supported by the constraint compiler.
 * Each has different zoning, fire access, and site plan requirements.
 */
export type AssetClass = 'self_storage' | 'rv_storage' | 'boat_storage';

/**
 * Pass 2 Input Contract — FROZEN
 *
 * This interface defines the ONLY inputs Pass 2 accepts.
 * Do not add financial fields. Do not add market data.
 */
export interface Pass2Input {
  /**
   * Target ZIP code (5-digit)
   * Used to resolve jurisdiction and lookup constraint cards.
   */
  zip_code: string;

  /**
   * Asset class determines constraint requirements.
   * Different asset types have different fire access, coverage, and permitting needs.
   */
  asset_class: AssetClass;

  /**
   * Requested acreage (optional).
   * If provided, envelope calculation will use this as gross acres.
   * If not provided, buildability envelope will be theoretical.
   */
  requested_acres?: number;

  /**
   * Run ID for traceability.
   * Links this Pass 2 run to Pass 1 output and future Pass 3 input.
   */
  run_id: string;

  /**
   * Pass 1 run ID (optional).
   * If provided, constraint compiler can reference Pass 1 data.
   */
  pass1_run_id?: string;

  /**
   * Parcel ID (optional).
   * If provided, enables parcel-specific constraint lookup.
   */
  parcel_id?: string;

  /**
   * Latitude for geo-based lookups (optional).
   */
  latitude?: number;

  /**
   * Longitude for geo-based lookups (optional).
   */
  longitude?: number;

  /**
   * State code (2-letter) for jurisdiction resolution.
   */
  state?: string;

  /**
   * County name for jurisdiction card lookup.
   */
  county?: string;
}

/**
 * Validate Pass 2 input.
 * Returns validation errors or empty array if valid.
 */
export function validatePass2Input(input: Pass2Input): string[] {
  const errors: string[] = [];

  // Required: zip_code
  if (!input.zip_code) {
    errors.push('zip_code is required');
  } else if (!/^\d{5}$/.test(input.zip_code)) {
    errors.push('zip_code must be 5 digits');
  }

  // Required: asset_class
  if (!input.asset_class) {
    errors.push('asset_class is required');
  } else if (!['self_storage', 'rv_storage', 'boat_storage'].includes(input.asset_class)) {
    errors.push('asset_class must be self_storage, rv_storage, or boat_storage');
  }

  // Required: run_id
  if (!input.run_id) {
    errors.push('run_id is required');
  }

  // Optional: requested_acres must be positive if provided
  if (input.requested_acres !== undefined && input.requested_acres <= 0) {
    errors.push('requested_acres must be positive');
  }

  return errors;
}
