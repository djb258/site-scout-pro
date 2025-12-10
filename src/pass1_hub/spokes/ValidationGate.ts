/**
 * PASS-1 VALIDATION GATE SPOKE
 *
 * Responsibility: Validate OpportunityObject completeness before Pass-2
 *
 * Ensures all required fields are populated and data quality meets thresholds.
 * Acts as a quality gate between Pass-1 and Pass-2 analysis.
 *
 * Validation Categories:
 *   1. Identity Block - ZIP, city, county, state, coordinates
 *   2. Macro Demand - Population, demand calculations
 *   3. Macro Supply - Competitor data
 *   4. Hotspot Scoring - Viability score computed
 *   5. Data Quality - Reasonable value ranges
 *
 * Outputs:
 *   - Pass1ValidationResult with validation score and blockers
 *   - pass2_ready boolean indicating if Pass-2 can proceed
 */

import type {
  OpportunityObject,
  Pass1ValidationResult,
  IdentityBlock,
  Pass1MacroResults,
} from '../../shared/OpportunityObject';
import { writeLog } from '../../shared/adapters/LovableAdapter';

// ============================================================================
// CONSTANTS
// ============================================================================

// Minimum thresholds for valid data
const THRESHOLDS = {
  MIN_POPULATION: 1000,
  MIN_DEMAND_SQFT: 5000,
  MIN_COUNTY_COUNT: 1,
  MIN_COORDINATES: {
    LAT_MIN: 24.5, // Southern tip of Florida
    LAT_MAX: 49.0, // Northern border
    LNG_MIN: -125.0, // Western coast
    LNG_MAX: -66.0, // Eastern coast
  },
};

// Field weights for validation score
const FIELD_WEIGHTS = {
  identity: 20,
  zip_metadata: 15,
  radius_counties: 10,
  competitors: 15,
  macro_demand: 15,
  macro_supply: 10,
  hotspot_score: 10,
  housing_signals: 5,
};

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationInput {
  opportunity: OpportunityObject;
  strict_mode?: boolean; // If true, warnings become blockers
}

export interface ValidationOutput {
  success: boolean;
  status: 'ok' | 'warning' | 'error';
  validation: Pass1ValidationResult;
  can_proceed_to_pass2: boolean;
}

interface FieldValidation {
  field: string;
  present: boolean;
  valid: boolean;
  issue?: string;
  is_blocker: boolean;
  weight: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Validate OpportunityObject for Pass-2 readiness
 *
 * @param input - Contains OpportunityObject to validate
 * @returns ValidationOutput with validation result and pass2 readiness
 */
export async function validateForPass2(input: ValidationInput): Promise<ValidationOutput> {
  const { opportunity, strict_mode = false } = input;

  console.log(`[VALIDATION_GATE] Validating OpportunityObject for ZIP: ${opportunity.identity?.zip}`);

  try {
    const validations: FieldValidation[] = [];

    // Validate Identity Block
    validations.push(...validateIdentityBlock(opportunity.identity));

    // Validate Pass1 Macro Results
    validations.push(...validateMacroResults(opportunity.pass1_macro));

    // Validate Data Quality
    validations.push(...validateDataQuality(opportunity));

    // Compile results
    const missing_fields = validations
      .filter(v => !v.present)
      .map(v => v.field);

    const invalid_fields = validations
      .filter(v => v.present && !v.valid)
      .map(v => `${v.field}: ${v.issue}`);

    const blockers = validations
      .filter(v => v.is_blocker && (!v.present || !v.valid))
      .map(v => v.issue || `${v.field} is missing or invalid`);

    const warnings = validations
      .filter(v => !v.is_blocker && (!v.present || !v.valid))
      .map(v => v.issue || `${v.field} is missing or invalid`);

    // Calculate validation score (0-100)
    const totalWeight = validations.reduce((sum, v) => sum + v.weight, 0);
    const earnedWeight = validations
      .filter(v => v.present && v.valid)
      .reduce((sum, v) => sum + v.weight, 0);
    const validation_score = totalWeight > 0
      ? Math.round((earnedWeight / totalWeight) * 100)
      : 0;

    // Determine pass2_ready
    let pass2_ready = blockers.length === 0;
    if (strict_mode && warnings.length > 0) {
      pass2_ready = false;
    }

    const validation: Pass1ValidationResult = {
      is_valid: blockers.length === 0,
      validation_timestamp: new Date().toISOString(),
      missing_fields,
      warnings: strict_mode ? [...warnings, ...invalid_fields] : warnings,
      pass2_ready,
      validation_score,
      blockers,
    };

    await writeLog('validation_gate_complete', {
      zip: opportunity.identity?.zip,
      validation_score,
      pass2_ready,
      blocker_count: blockers.length,
      warning_count: warnings.length,
    });

    console.log(`[VALIDATION_GATE] Score: ${validation_score}, Pass2 Ready: ${pass2_ready}, Blockers: ${blockers.length}`);

    return {
      success: true,
      status: blockers.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'ok'),
      validation,
      can_proceed_to_pass2: pass2_ready,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VALIDATION_GATE] Error:', error);

    return {
      success: false,
      status: 'error',
      validation: {
        is_valid: false,
        validation_timestamp: new Date().toISOString(),
        missing_fields: [],
        warnings: [],
        pass2_ready: false,
        validation_score: 0,
        blockers: [errorMessage],
      },
      can_proceed_to_pass2: false,
    };
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate Identity Block fields
 */
function validateIdentityBlock(identity?: IdentityBlock): FieldValidation[] {
  const validations: FieldValidation[] = [];

  // ZIP (required, blocker)
  validations.push({
    field: 'identity.zip',
    present: !!identity?.zip,
    valid: !!identity?.zip && /^\d{5}$/.test(identity.zip),
    issue: !identity?.zip ? 'ZIP code is required' : 'ZIP must be 5 digits',
    is_blocker: true,
    weight: 5,
  });

  // City (required, not blocker)
  validations.push({
    field: 'identity.city',
    present: !!identity?.city,
    valid: !!identity?.city && identity.city.length > 0,
    issue: 'City name is missing',
    is_blocker: false,
    weight: 2,
  });

  // County (required, blocker)
  validations.push({
    field: 'identity.county',
    present: !!identity?.county,
    valid: !!identity?.county && identity.county.length > 0,
    issue: 'County is required for Pass-2 analysis',
    is_blocker: true,
    weight: 5,
  });

  // State (required, blocker)
  validations.push({
    field: 'identity.state',
    present: !!identity?.state,
    valid: !!identity?.state && identity.state.length >= 2,
    issue: 'State is required for Pass-2 analysis',
    is_blocker: true,
    weight: 3,
  });

  // Coordinates (required, blocker)
  const validLat = identity?.lat !== undefined &&
    identity.lat >= THRESHOLDS.MIN_COORDINATES.LAT_MIN &&
    identity.lat <= THRESHOLDS.MIN_COORDINATES.LAT_MAX;
  const validLng = identity?.lng !== undefined &&
    identity.lng >= THRESHOLDS.MIN_COORDINATES.LNG_MIN &&
    identity.lng <= THRESHOLDS.MIN_COORDINATES.LNG_MAX;

  validations.push({
    field: 'identity.lat',
    present: identity?.lat !== undefined,
    valid: validLat,
    issue: 'Invalid or missing latitude coordinate',
    is_blocker: true,
    weight: 3,
  });

  validations.push({
    field: 'identity.lng',
    present: identity?.lng !== undefined,
    valid: validLng,
    issue: 'Invalid or missing longitude coordinate',
    is_blocker: true,
    weight: 2,
  });

  return validations;
}

/**
 * Validate Pass1 Macro Results
 */
function validateMacroResults(macro?: Pass1MacroResults): FieldValidation[] {
  const validations: FieldValidation[] = [];

  // ZIP Metadata (required, blocker)
  validations.push({
    field: 'pass1_macro.zip_metadata',
    present: !!macro?.zip_metadata?.zip,
    valid: !!macro?.zip_metadata?.population,
    issue: 'ZIP metadata is required for demand calculations',
    is_blocker: true,
    weight: FIELD_WEIGHTS.zip_metadata,
  });

  // Radius Counties (required, warning if empty)
  validations.push({
    field: 'pass1_macro.radius_counties',
    present: Array.isArray(macro?.radius_counties),
    valid: (macro?.radius_counties?.length || 0) >= THRESHOLDS.MIN_COUNTY_COUNT,
    issue: 'No counties found in 120-mile radius',
    is_blocker: false,
    weight: FIELD_WEIGHTS.radius_counties,
  });

  // Competitors (optional but scored)
  validations.push({
    field: 'pass1_macro.competitors',
    present: Array.isArray(macro?.competitors),
    valid: true, // Zero competitors is valid (undersupplied market)
    issue: undefined,
    is_blocker: false,
    weight: FIELD_WEIGHTS.competitors,
  });

  // Macro Demand (required, blocker)
  validations.push({
    field: 'pass1_macro.macro_demand',
    present: !!macro?.macro_demand?.demand_sqft,
    valid: (macro?.macro_demand?.demand_sqft || 0) >= THRESHOLDS.MIN_DEMAND_SQFT,
    issue: 'Macro demand calculation is incomplete or too low',
    is_blocker: true,
    weight: FIELD_WEIGHTS.macro_demand,
  });

  // Macro Supply (required, blocker)
  validations.push({
    field: 'pass1_macro.macro_supply',
    present: macro?.macro_supply !== undefined,
    valid: macro?.macro_supply?.competitor_count !== undefined,
    issue: 'Macro supply calculation is incomplete',
    is_blocker: true,
    weight: FIELD_WEIGHTS.macro_supply,
  });

  // Hotspot Score (required, blocker)
  validations.push({
    field: 'pass1_macro.hotspot_score',
    present: !!macro?.hotspot_score,
    valid: macro?.hotspot_score?.overall_score !== undefined &&
      ['A', 'B', 'C', 'D'].includes(macro?.hotspot_score?.tier || ''),
    issue: 'Hotspot score not computed',
    is_blocker: true,
    weight: FIELD_WEIGHTS.hotspot_score,
  });

  // Housing Signals (optional)
  validations.push({
    field: 'pass1_macro.housing_signals',
    present: !!macro?.housing_signals,
    valid: true,
    issue: undefined,
    is_blocker: false,
    weight: FIELD_WEIGHTS.housing_signals,
  });

  return validations;
}

/**
 * Validate data quality and ranges
 */
function validateDataQuality(opportunity: OpportunityObject): FieldValidation[] {
  const validations: FieldValidation[] = [];
  const macro = opportunity.pass1_macro;

  // Population reasonableness
  const population = macro?.zip_metadata?.population || 0;
  validations.push({
    field: 'data_quality.population',
    present: population > 0,
    valid: population >= THRESHOLDS.MIN_POPULATION,
    issue: `Population ${population} is below minimum threshold of ${THRESHOLDS.MIN_POPULATION}`,
    is_blocker: false,
    weight: 3,
  });

  // Demand calculation consistency
  const expectedDemand = population * 6;
  const actualDemand = macro?.macro_demand?.demand_sqft || 0;
  const demandVariance = expectedDemand > 0
    ? Math.abs(actualDemand - expectedDemand) / expectedDemand
    : 1;

  validations.push({
    field: 'data_quality.demand_consistency',
    present: actualDemand > 0,
    valid: demandVariance < 0.1, // Within 10% of expected
    issue: `Demand calculation variance (${Math.round(demandVariance * 100)}%) exceeds threshold`,
    is_blocker: false,
    weight: 2,
  });

  // Hotspot score reasonableness
  const score = macro?.hotspot_score?.overall_score;
  validations.push({
    field: 'data_quality.hotspot_score',
    present: score !== undefined,
    valid: score !== undefined && score >= 0 && score <= 100,
    issue: 'Hotspot score out of valid range (0-100)',
    is_blocker: false,
    weight: 2,
  });

  // Competitor enrichment (if present, check completeness)
  if (macro?.competitor_enrichment) {
    validations.push({
      field: 'data_quality.competitor_enrichment',
      present: true,
      valid: macro.competitor_enrichment.enrichment_complete === true,
      issue: 'Competitor enrichment incomplete',
      is_blocker: false,
      weight: 2,
    });
  }

  return validations;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick check if opportunity is Pass-2 ready (without full validation)
 */
export function isPass2Ready(opportunity: OpportunityObject): boolean {
  const identity = opportunity.identity;
  const macro = opportunity.pass1_macro;

  // Critical checks only
  return !!(
    identity?.zip &&
    identity?.county &&
    identity?.state &&
    identity?.lat &&
    identity?.lng &&
    macro?.macro_demand?.demand_sqft &&
    macro?.macro_supply &&
    macro?.hotspot_score?.tier
  );
}

/**
 * Get missing critical fields for debugging
 */
export function getMissingCriticalFields(opportunity: OpportunityObject): string[] {
  const missing: string[] = [];
  const identity = opportunity.identity;
  const macro = opportunity.pass1_macro;

  if (!identity?.zip) missing.push('identity.zip');
  if (!identity?.county) missing.push('identity.county');
  if (!identity?.state) missing.push('identity.state');
  if (!identity?.lat) missing.push('identity.lat');
  if (!identity?.lng) missing.push('identity.lng');
  if (!macro?.macro_demand?.demand_sqft) missing.push('macro_demand');
  if (!macro?.macro_supply) missing.push('macro_supply');
  if (!macro?.hotspot_score?.tier) missing.push('hotspot_score');

  return missing;
}

/**
 * Calculate completion percentage
 */
export function getCompletionPercentage(opportunity: OpportunityObject): number {
  const identity = opportunity.identity;
  const macro = opportunity.pass1_macro;

  const fields = [
    identity?.zip,
    identity?.city,
    identity?.county,
    identity?.state,
    identity?.lat,
    identity?.lng,
    identity?.county_fips,
    macro?.zip_metadata?.population,
    macro?.radius_counties?.length,
    macro?.competitors?.length !== undefined,
    macro?.macro_demand?.demand_sqft,
    macro?.macro_supply?.competitor_count !== undefined,
    macro?.hotspot_score?.tier,
    macro?.housing_signals,
    macro?.industrial_signals,
    macro?.rv_lake_signals,
    macro?.competitor_enrichment?.enrichment_complete,
  ];

  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { THRESHOLDS, FIELD_WEIGHTS };
