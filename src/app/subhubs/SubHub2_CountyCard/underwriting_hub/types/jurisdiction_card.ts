// =============================================================================
// JURISDICTION CARD — Core Data Structure for Pass 2
// =============================================================================
// Doctrine: Pass 2 = Jurisdiction Card Completion Engine
// Reference: ADR-019, docs/doctrine/Pass2ReallyIs.md
//
// Jurisdiction Cards store CONSTANTS, not outcomes.
// They are reusable across multiple sites in the same jurisdiction.
// =============================================================================

/**
 * Asset classes supported by jurisdiction cards.
 */
export type AssetClass = 'self_storage' | 'rv_storage' | 'boat_storage';

/**
 * Authority types that may have jurisdiction over a site.
 */
export type AuthorityType =
  | 'county'
  | 'municipal'
  | 'watershed'
  | 'fire_district'
  | 'dot'
  | 'utility'
  | 'other';

/**
 * Confidence level for a field value.
 */
export type ConfidenceLevel = 'verified' | 'inferred' | 'estimated' | 'unknown';

/**
 * Zoning allowance status.
 */
export type ZoningAllowance =
  | 'by_right'           // Allowed without special approval
  | 'conditional_use'    // Requires CUP
  | 'special_exception'  // Requires variance or exception
  | 'prohibited'         // Not allowed
  | 'unknown';           // Cannot determine

// =============================================================================
// JURISDICTION CARD SECTIONS
// =============================================================================

/**
 * Zoning constraints from the jurisdiction card.
 */
export interface ZoningSection {
  // Allowance
  storage_allowed: ZoningAllowance;
  zoning_code: string | null;
  zoning_district: string | null;

  // Dimensional
  setback_front_ft: number | null;
  setback_side_ft: number | null;
  setback_rear_ft: number | null;
  max_height_ft: number | null;
  max_stories: number | null;
  max_lot_coverage_pct: number | null;
  floor_area_ratio: number | null;

  // Restrictions
  min_lot_size_acres: number | null;
  max_building_footprint_sqft: number | null;

  // Provenance
  source: string | null;
  confidence: ConfidenceLevel;
  verified_at: string | null;
}

/**
 * Site plan constraints from the jurisdiction card.
 */
export interface SitePlanSection {
  // Parking
  min_parking_spaces: number | null;
  parking_ratio: string | null;  // e.g., "1 per 5,000 sqft"
  ada_spaces_required: number | null;

  // Landscaping
  landscape_pct_required: number | null;
  landscape_buffer_ft: number | null;
  screening_required: boolean | null;

  // Impervious
  max_impervious_pct: number | null;

  // Provenance
  source: string | null;
  confidence: ConfidenceLevel;
  verified_at: string | null;
}

/**
 * Stormwater constraints from the jurisdiction card.
 */
export interface StormwaterSection {
  // Requirements
  stormwater_plan_required: boolean | null;
  detention_required: boolean | null;
  retention_required: boolean | null;
  infiltration_allowed: boolean | null;

  // Design criteria
  design_storm_event: string | null;  // e.g., "100-year, 24-hour"
  release_rate_requirement: string | null;
  water_quality_required: boolean | null;

  // Thresholds
  disturbance_threshold_acres: number | null;

  // Provenance
  source: string | null;
  confidence: ConfidenceLevel;
  verified_at: string | null;
}

/**
 * Fire access constraints from the jurisdiction card.
 */
export interface FireAccessSection {
  // Fire lanes
  fire_lane_required: boolean | null;
  fire_lane_width_ft: number | null;
  fire_lane_turnaround_required: boolean | null;

  // Hydrants
  hydrant_required: boolean | null;
  hydrant_spacing_ft: number | null;

  // Building
  sprinkler_required: boolean | null;
  fire_alarm_required: boolean | null;

  // Access
  knox_box_required: boolean | null;

  // Provenance
  source: string | null;
  confidence: ConfidenceLevel;
  verified_at: string | null;
}

/**
 * Slope and grading constraints from the jurisdiction card.
 */
export interface GradingSection {
  // Slope limits
  max_slope_pct: number | null;
  cut_fill_permit_required: boolean | null;

  // Grading permits
  grading_permit_threshold_sqft: number | null;
  erosion_control_required: boolean | null;

  // Provenance
  source: string | null;
  confidence: ConfidenceLevel;
  verified_at: string | null;
}

/**
 * Financial assurance requirements from the jurisdiction card.
 * NOTE: These are REQUIREMENTS, not calculations.
 */
export interface BondingSection {
  // Bonds required
  performance_bond_required: boolean | null;
  completion_bond_required: boolean | null;
  stormwater_maintenance_bond_required: boolean | null;

  // Amounts (if fixed by jurisdiction)
  bond_amount_formula: string | null;  // e.g., "125% of improvement cost"

  // Provenance
  source: string | null;
  confidence: ConfidenceLevel;
  verified_at: string | null;
}

/**
 * A single permit in the approval checklist.
 */
export interface PermitRequirement {
  permit_type: string;
  authority: AuthorityType;
  authority_name: string | null;
  required: boolean;
  description: string;

  // NOT duration estimates — just existence
  pre_application_required: boolean | null;
  public_hearing_required: boolean | null;

  // Code reference
  code_reference: string | null;
}

// =============================================================================
// JURISDICTION CARD — Main Interface
// =============================================================================

/**
 * Jurisdiction Card — The core data structure for Pass 2.
 *
 * DOCTRINE:
 * - Stores CONSTANTS, not outcomes
 * - Reusable across multiple sites
 * - Unknown fields are explicit (never guessed)
 * - Pass 3 trusts this blindly
 */
export interface JurisdictionCard {
  // Identity
  card_id: string;
  jurisdiction_id: string;
  state: string;
  county: string;
  municipality: string | null;
  asset_class: AssetClass;

  // Metadata
  created_at: string;
  updated_at: string;
  version: number;

  // Sections
  zoning: ZoningSection;
  site_plan: SitePlanSection;
  stormwater: StormwaterSection;
  fire_access: FireAccessSection;
  grading: GradingSection;
  bonding: BondingSection;

  // Approval checklist
  permits_required: PermitRequirement[];

  // Authorities with jurisdiction
  authorities: {
    type: AuthorityType;
    name: string;
    jurisdiction_scope: string | null;
  }[];

  // Storage-specific code references
  code_references: {
    code_name: string;
    section: string;
    description: string;
    url: string | null;
  }[];

  // Overall provenance
  provenance: {
    primary_source: string;
    overall_confidence: ConfidenceLevel;
    last_verified: string | null;
    research_notes: string | null;
  };
}

// =============================================================================
// COMPLETENESS VALIDATOR
// =============================================================================

/**
 * Fields required for Pass 3 to run.
 * If any of these are null/unknown, Pass 2 returns HOLD_INCOMPLETE.
 */
export const REQUIRED_FIELDS_FOR_PASS3: string[] = [
  'zoning.storage_allowed',
  'zoning.setback_front_ft',
  'zoning.setback_side_ft',
  'zoning.setback_rear_ft',
  'zoning.max_lot_coverage_pct',
  'stormwater.stormwater_plan_required',
  'fire_access.fire_lane_required',
];

/**
 * Result of validating jurisdiction card completeness.
 */
export interface CardCompletenessResult {
  complete: boolean;
  required_fields_present: string[];
  required_fields_missing: string[];
  optional_fields_missing: string[];
  fatal_prohibitions: string[];
  confidence_warnings: string[];
}

/**
 * Validate jurisdiction card completeness for Pass 3.
 *
 * @param card The jurisdiction card to validate
 * @returns Completeness result
 */
export function validateCardCompleteness(card: JurisdictionCard): CardCompletenessResult {
  const result: CardCompletenessResult = {
    complete: true,
    required_fields_present: [],
    required_fields_missing: [],
    optional_fields_missing: [],
    fatal_prohibitions: [],
    confidence_warnings: [],
  };

  // Check for fatal prohibitions first
  if (card.zoning.storage_allowed === 'prohibited') {
    result.fatal_prohibitions.push('Storage use is prohibited in this jurisdiction');
    result.complete = false;
    return result;
  }

  // Check required fields
  for (const fieldPath of REQUIRED_FIELDS_FOR_PASS3) {
    const value = getFieldValue(card, fieldPath);

    if (value === null || value === undefined || value === 'unknown') {
      result.required_fields_missing.push(fieldPath);
      result.complete = false;
    } else {
      result.required_fields_present.push(fieldPath);
    }
  }

  // Check confidence warnings
  const sections: (keyof JurisdictionCard)[] = [
    'zoning',
    'site_plan',
    'stormwater',
    'fire_access',
    'grading',
    'bonding',
  ];

  for (const section of sections) {
    const sectionData = card[section] as { confidence?: ConfidenceLevel };
    if (sectionData?.confidence === 'estimated' || sectionData?.confidence === 'unknown') {
      result.confidence_warnings.push(
        `${section} has ${sectionData.confidence} confidence — manual verification recommended`
      );
    }
  }

  return result;
}

/**
 * Get a nested field value from an object using dot notation.
 */
function getFieldValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[part];
  }

  return current;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an empty jurisdiction card with all fields set to null/unknown.
 * Used when starting research for a new jurisdiction.
 */
export function createEmptyJurisdictionCard(
  jurisdictionId: string,
  state: string,
  county: string,
  assetClass: AssetClass,
  municipality?: string
): JurisdictionCard {
  const now = new Date().toISOString();

  return {
    card_id: `JC-${state}-${county.toLowerCase().replace(/\s+/g, '-')}-${assetClass}-${Date.now()}`,
    jurisdiction_id: jurisdictionId,
    state,
    county,
    municipality: municipality ?? null,
    asset_class: assetClass,

    created_at: now,
    updated_at: now,
    version: 1,

    zoning: {
      storage_allowed: 'unknown',
      zoning_code: null,
      zoning_district: null,
      setback_front_ft: null,
      setback_side_ft: null,
      setback_rear_ft: null,
      max_height_ft: null,
      max_stories: null,
      max_lot_coverage_pct: null,
      floor_area_ratio: null,
      min_lot_size_acres: null,
      max_building_footprint_sqft: null,
      source: null,
      confidence: 'unknown',
      verified_at: null,
    },

    site_plan: {
      min_parking_spaces: null,
      parking_ratio: null,
      ada_spaces_required: null,
      landscape_pct_required: null,
      landscape_buffer_ft: null,
      screening_required: null,
      max_impervious_pct: null,
      source: null,
      confidence: 'unknown',
      verified_at: null,
    },

    stormwater: {
      stormwater_plan_required: null,
      detention_required: null,
      retention_required: null,
      infiltration_allowed: null,
      design_storm_event: null,
      release_rate_requirement: null,
      water_quality_required: null,
      disturbance_threshold_acres: null,
      source: null,
      confidence: 'unknown',
      verified_at: null,
    },

    fire_access: {
      fire_lane_required: null,
      fire_lane_width_ft: null,
      fire_lane_turnaround_required: null,
      hydrant_required: null,
      hydrant_spacing_ft: null,
      sprinkler_required: null,
      fire_alarm_required: null,
      knox_box_required: null,
      source: null,
      confidence: 'unknown',
      verified_at: null,
    },

    grading: {
      max_slope_pct: null,
      cut_fill_permit_required: null,
      grading_permit_threshold_sqft: null,
      erosion_control_required: null,
      source: null,
      confidence: 'unknown',
      verified_at: null,
    },

    bonding: {
      performance_bond_required: null,
      completion_bond_required: null,
      stormwater_maintenance_bond_required: null,
      bond_amount_formula: null,
      source: null,
      confidence: 'unknown',
      verified_at: null,
    },

    permits_required: [],
    authorities: [],
    code_references: [],

    provenance: {
      primary_source: 'PENDING_RESEARCH',
      overall_confidence: 'unknown',
      last_verified: null,
      research_notes: null,
    },
  };
}

/**
 * Identify fields that need research for a partial card.
 */
export function identifyResearchNeeds(card: JurisdictionCard): {
  critical: string[];
  optional: string[];
} {
  const completeness = validateCardCompleteness(card);

  return {
    critical: completeness.required_fields_missing,
    optional: completeness.optional_fields_missing,
  };
}
