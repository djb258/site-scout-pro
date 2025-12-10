/**
 * PASS-1 → PASS-2 HANDOFF VALIDATOR
 *
 * Validates that an OpportunityObject from Pass-1 has sufficient data
 * to proceed to Pass-2 underwriting. Does NOT hit the database.
 *
 * Usage:
 *   - UI: Disable Pass-2 button unless validation.ok === true
 *   - Edge Function: Gate Pass-2 invocation with validation check
 *   - Orchestrator: Pre-flight validation before spoke execution
 *
 * Returns blockers (fatal), warnings (non-fatal), and field status.
 */

import type {
  OpportunityObject,
  Pass1MacroResults,
  ZipMetadata,
  MacroDemandResult,
  MacroSupplyResult,
  HotspotScore,
  Competitor,
  Pass1Recommendation,
  Pass1ValidationResult,
  CompetitorEnrichmentSummary,
} from '../shared/OpportunityObject';

// ============================================================================
// VALIDATION RESULT INTERFACE
// ============================================================================

export interface Pass1ToPass2Validation {
  /** Overall pass/fail - true if no blockers exist */
  ok: boolean;

  /** Critical issues that MUST be resolved before Pass-2 */
  blockers: string[];

  /** Non-critical issues that should be addressed but don't block Pass-2 */
  warnings: string[];

  /** Fields that are present and valid */
  required_fields: string[];

  /** Optional fields that are missing but not blocking */
  optional_fields: string[];

  /** Enrichment status for downstream spokes */
  enrichment_status: {
    competitor_enrichment_ready: boolean;
    call_sheet_ready: boolean;
  };

  /** Validation metadata */
  validation_meta: {
    validated_at: string;
    pass1_id: string;
    zip: string;
    validation_score: number; // 0-100 completeness
  };
}

// ============================================================================
// REQUIRED FIELD DEFINITIONS
// ============================================================================

/**
 * Fields that MUST be present for Pass-2 to run.
 * Missing any of these = blocker.
 */
const REQUIRED_IDENTITY_FIELDS = ['zip', 'city', 'county', 'state', 'state_id', 'lat', 'lng'] as const;

const REQUIRED_MACRO_FIELDS = [
  'zip_metadata',
  'macro_demand',
  'macro_supply',
  'hotspot_score',
] as const;

const REQUIRED_ZIP_METADATA_FIELDS = [
  'population',
  'income_household_median',
  'home_value',
] as const;

/**
 * Fields that SHOULD be present but won't block Pass-2.
 * Missing these = warning.
 */
const OPTIONAL_MACRO_FIELDS = [
  'radius_counties',
  'competitors',
  'housing_signals',
  'anchors',
  'rv_lake_signals',
  'industrial_signals',
  'competitor_enrichment',
  'validation',
] as const;

// ============================================================================
// VALIDATION THRESHOLDS
// ============================================================================

const MIN_POPULATION = 1000; // Minimum viable population
const MIN_INCOME = 25000; // Minimum household income
const MIN_VIABILITY_SCORE = 20; // Minimum Pass-1 score to proceed
const MIN_COMPETITORS_FOR_PRICING = 3; // Need at least 3 comps for reliable pricing

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate Pass-1 OpportunityObject for Pass-2 readiness.
 *
 * @param opportunity - The OpportunityObject from Pass-1
 * @returns Pass1ToPass2Validation with ok, blockers, warnings, etc.
 *
 * @example
 * const validation = validatePass1ToPass2(opportunity);
 * if (!validation.ok) {
 *   // Show blockers to user, disable Pass-2 button
 *   console.log('Cannot proceed:', validation.blockers);
 * }
 */
export function validatePass1ToPass2(opportunity: OpportunityObject): Pass1ToPass2Validation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const required_fields: string[] = [];
  const optional_fields: string[] = [];

  const validatedAt = new Date().toISOString();

  // -------------------------------------------------------------------------
  // 1. IDENTITY BLOCK VALIDATION
  // -------------------------------------------------------------------------
  if (!opportunity.identity) {
    blockers.push('IDENTITY_MISSING: No identity block found');
  } else {
    for (const field of REQUIRED_IDENTITY_FIELDS) {
      const value = opportunity.identity[field];
      if (value === undefined || value === null || value === '') {
        blockers.push(`IDENTITY_FIELD_MISSING: identity.${field} is required`);
      } else {
        required_fields.push(`identity.${field}`);
      }
    }

    // Validate coordinates are reasonable
    if (opportunity.identity.lat !== undefined && opportunity.identity.lng !== undefined) {
      if (
        opportunity.identity.lat < 24 ||
        opportunity.identity.lat > 72 ||
        opportunity.identity.lng < -180 ||
        opportunity.identity.lng > -60
      ) {
        warnings.push('IDENTITY_COORDS_SUSPECT: Coordinates may be outside US bounds');
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. PASS-1 MACRO RESULTS VALIDATION
  // -------------------------------------------------------------------------
  if (!opportunity.pass1_macro) {
    blockers.push('PASS1_MACRO_MISSING: No Pass-1 macro results found');
  } else {
    // Check required macro fields
    for (const field of REQUIRED_MACRO_FIELDS) {
      const value = opportunity.pass1_macro[field];
      if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
        blockers.push(`MACRO_FIELD_MISSING: pass1_macro.${field} is required`);
      } else {
        required_fields.push(`pass1_macro.${field}`);
      }
    }

    // Check optional macro fields
    for (const field of OPTIONAL_MACRO_FIELDS) {
      const value = opportunity.pass1_macro[field as keyof Pass1MacroResults];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        optional_fields.push(`pass1_macro.${field}`);
      }
    }

    // Validate zip_metadata content
    if (opportunity.pass1_macro.zip_metadata) {
      const zipMeta = opportunity.pass1_macro.zip_metadata;

      for (const field of REQUIRED_ZIP_METADATA_FIELDS) {
        const value = zipMeta[field];
        if (value === undefined || value === null) {
          blockers.push(`ZIP_METADATA_FIELD_MISSING: zip_metadata.${field} is required`);
        } else {
          required_fields.push(`zip_metadata.${field}`);
        }
      }

      // Check population threshold
      if (zipMeta.population !== undefined && zipMeta.population < MIN_POPULATION) {
        warnings.push(
          `LOW_POPULATION: Population ${zipMeta.population} is below threshold (${MIN_POPULATION}). Market may be too small.`
        );
      }

      // Check income threshold
      if (zipMeta.income_household_median !== undefined && zipMeta.income_household_median < MIN_INCOME) {
        warnings.push(
          `LOW_INCOME: Median income $${zipMeta.income_household_median} is below threshold ($${MIN_INCOME}). Pricing power may be limited.`
        );
      }
    }

    // Validate macro_demand
    if (opportunity.pass1_macro.macro_demand) {
      const demand = opportunity.pass1_macro.macro_demand;
      if (!demand.demand_sqft || demand.demand_sqft <= 0) {
        blockers.push('DEMAND_INVALID: macro_demand.demand_sqft must be > 0');
      }
      if (!demand.population || demand.population <= 0) {
        blockers.push('DEMAND_INVALID: macro_demand.population must be > 0');
      }
    }

    // Validate macro_supply
    if (opportunity.pass1_macro.macro_supply) {
      const supply = opportunity.pass1_macro.macro_supply;
      if (supply.competitor_count === undefined) {
        warnings.push('SUPPLY_INCOMPLETE: macro_supply.competitor_count is missing');
      }
      if (supply.total_supply_sqft === undefined) {
        warnings.push('SUPPLY_INCOMPLETE: macro_supply.total_supply_sqft is missing');
      }
    }

    // Validate hotspot_score
    if (opportunity.pass1_macro.hotspot_score) {
      const hotspot = opportunity.pass1_macro.hotspot_score;
      if (hotspot.overall_score === undefined || hotspot.overall_score === null) {
        blockers.push('HOTSPOT_INVALID: hotspot_score.overall_score is required');
      }
      if (!hotspot.tier) {
        blockers.push('HOTSPOT_INVALID: hotspot_score.tier is required');
      }
    }

    // Check competitors for pricing readiness
    const competitors = opportunity.pass1_macro.competitors || [];
    if (competitors.length === 0) {
      warnings.push('NO_COMPETITORS: No competitors found. Pricing verification will use market defaults.');
    } else if (competitors.length < MIN_COMPETITORS_FOR_PRICING) {
      warnings.push(
        `FEW_COMPETITORS: Only ${competitors.length} competitors found. Pricing confidence may be limited.`
      );
    }
  }

  // -------------------------------------------------------------------------
  // 3. PASS-1 RECOMMENDATION VALIDATION
  // -------------------------------------------------------------------------
  if (!opportunity.pass1_recommendation) {
    blockers.push('RECOMMENDATION_MISSING: No Pass-1 recommendation found');
  } else {
    const rec = opportunity.pass1_recommendation;

    if (rec.viability_score === undefined || rec.viability_score === null) {
      blockers.push('RECOMMENDATION_INVALID: viability_score is required');
    } else {
      required_fields.push('pass1_recommendation.viability_score');

      // Check viability threshold
      if (rec.viability_score < MIN_VIABILITY_SCORE) {
        warnings.push(
          `LOW_VIABILITY: Pass-1 viability score ${rec.viability_score} is below threshold (${MIN_VIABILITY_SCORE}). Consider reviewing before Pass-2.`
        );
      }
    }

    if (!rec.tier) {
      blockers.push('RECOMMENDATION_INVALID: tier is required');
    } else {
      required_fields.push('pass1_recommendation.tier');
    }

    // Check if Pass-1 explicitly said "don't proceed"
    if (rec.proceed_to_pass2 === false) {
      warnings.push(
        'PASS1_RECOMMENDED_SKIP: Pass-1 recommended NOT proceeding to Pass-2. Review key_factors and risk_factors.'
      );
    }
  }

  // -------------------------------------------------------------------------
  // 4. STATUS AND PREREQUISITE VALIDATION
  // -------------------------------------------------------------------------
  const validStatuses = ['pass1_complete', 'local_scan_complete'];
  if (!validStatuses.includes(opportunity.status)) {
    blockers.push(
      `STATUS_INVALID: Current status "${opportunity.status}" is not valid for Pass-2. Expected: ${validStatuses.join(' or ')}`
    );
  } else {
    required_fields.push('status');
  }

  // Check pass2_ready flag
  if (opportunity.pass2_ready === false) {
    warnings.push('PASS2_READY_FALSE: pass2_ready flag is false. Prerequisites may be incomplete.');
  }

  // Check prerequisites
  if (opportunity.pass2_prerequisites) {
    if (!opportunity.pass2_prerequisites.has_competitor_list) {
      warnings.push('PREREQ_MISSING: has_competitor_list is false. Competitive analysis may be limited.');
    }
    if (!opportunity.pass2_prerequisites.has_pricing_data) {
      warnings.push('PREREQ_MISSING: has_pricing_data is false. Pricing verification will use market defaults.');
    }
    // has_zoning_lookup is optional - Pass-2 can fetch zoning
  }

  // -------------------------------------------------------------------------
  // 5. ENRICHMENT STATUS CHECK
  // -------------------------------------------------------------------------
  const competitorEnrichmentReady = Boolean(
    opportunity.pass1_macro?.competitor_enrichment?.enrichment_complete
  );

  const callSheetReady = Boolean(
    opportunity.local_scan?.call_sheet &&
    opportunity.local_scan.call_sheet.length > 0
  );

  if (!competitorEnrichmentReady) {
    optional_fields.push('pass1_macro.competitor_enrichment');
  }

  if (!callSheetReady) {
    optional_fields.push('local_scan.call_sheet');
  }

  // -------------------------------------------------------------------------
  // 6. CALCULATE VALIDATION SCORE
  // -------------------------------------------------------------------------
  const totalRequiredFields =
    REQUIRED_IDENTITY_FIELDS.length +
    REQUIRED_MACRO_FIELDS.length +
    REQUIRED_ZIP_METADATA_FIELDS.length +
    3; // viability_score, tier, status

  const validationScore = Math.round((required_fields.length / totalRequiredFields) * 100);

  // -------------------------------------------------------------------------
  // 7. BUILD RESULT
  // -------------------------------------------------------------------------
  const result: Pass1ToPass2Validation = {
    ok: blockers.length === 0,
    blockers,
    warnings,
    required_fields,
    optional_fields,
    enrichment_status: {
      competitor_enrichment_ready: competitorEnrichmentReady,
      call_sheet_ready: callSheetReady,
    },
    validation_meta: {
      validated_at: validatedAt,
      pass1_id: opportunity.id || 'unknown',
      zip: opportunity.identity?.zip || 'unknown',
      validation_score: validationScore,
    },
  };

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick check if Pass-1 is ready for Pass-2 (no blockers).
 * Use this for simple boolean checks in UI.
 */
export function isPass2Ready(opportunity: OpportunityObject): boolean {
  const validation = validatePass1ToPass2(opportunity);
  return validation.ok;
}

/**
 * Get formatted blocker messages for UI display.
 */
export function getBlockerMessages(validation: Pass1ToPass2Validation): string[] {
  return validation.blockers.map((b) => {
    const [code, message] = b.split(': ');
    return message || b;
  });
}

/**
 * Get formatted warning messages for UI display.
 */
export function getWarningMessages(validation: Pass1ToPass2Validation): string[] {
  return validation.warnings.map((w) => {
    const [code, message] = w.split(': ');
    return message || w;
  });
}

/**
 * Create a validation summary for logging.
 */
export function createValidationSummary(validation: Pass1ToPass2Validation): string {
  const status = validation.ok ? 'PASS' : 'FAIL';
  const blockerCount = validation.blockers.length;
  const warningCount = validation.warnings.length;
  const score = validation.validation_meta.validation_score;

  return `[P1→P2 Validation] ${status} | Score: ${score}% | Blockers: ${blockerCount} | Warnings: ${warningCount} | ZIP: ${validation.validation_meta.zip}`;
}

// ============================================================================
// EXAMPLE BLOCKED RESPONSE (for documentation/reference)
// ============================================================================

/**
 * Example of a blocked validation response:
 *
 * {
 *   "ok": false,
 *   "blockers": [
 *     "IDENTITY_FIELD_MISSING: identity.county is required",
 *     "MACRO_FIELD_MISSING: pass1_macro.macro_demand is required",
 *     "HOTSPOT_INVALID: hotspot_score.overall_score is required"
 *   ],
 *   "warnings": [
 *     "LOW_POPULATION: Population 850 is below threshold (1000). Market may be too small.",
 *     "NO_COMPETITORS: No competitors found. Pricing verification will use market defaults."
 *   ],
 *   "required_fields": [
 *     "identity.zip",
 *     "identity.city",
 *     "identity.state",
 *     "identity.state_id",
 *     "identity.lat",
 *     "identity.lng",
 *     "pass1_macro.zip_metadata",
 *     "pass1_macro.macro_supply",
 *     "pass1_macro.hotspot_score"
 *   ],
 *   "optional_fields": [
 *     "pass1_macro.competitors",
 *     "pass1_macro.competitor_enrichment",
 *     "local_scan.call_sheet"
 *   ],
 *   "enrichment_status": {
 *     "competitor_enrichment_ready": false,
 *     "call_sheet_ready": false
 *   },
 *   "validation_meta": {
 *     "validated_at": "2025-01-15T10:30:00.000Z",
 *     "pass1_id": "abc123",
 *     "zip": "75001",
 *     "validation_score": 65
 *   }
 * }
 *
 * UI GUIDANCE:
 * - Disable "Start Pass-2" button unless validation.ok === true
 * - Show blockers in red alert box
 * - Show warnings in yellow warning box
 * - Show validation_score as progress indicator
 */

// Re-export types
export type { OpportunityObject };
