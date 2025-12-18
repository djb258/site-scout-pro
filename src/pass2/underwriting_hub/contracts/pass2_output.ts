// =============================================================================
// PASS 2 OUTPUT CONTRACT — Jurisdiction Card Completion Result
// =============================================================================
// Doctrine ID: SS.02.00.OUT
// Purpose: Define the ONLY outputs from Pass 2 Constraint Compiler
//
// DOCTRINE (ADR-019): Pass 2 = Jurisdiction Card Completion Engine
//
// Pass 2 returns NO conclusions, only FACTS:
// - jurisdiction_card_complete: boolean
// - required_fields_missing[]
// - manual_research_required: boolean
// - geometry_constraints (if complete)
// - approval_checklist
// - fatal_prohibitions
//
// NO dollars. NO NOI. NO timelines. NO revenue projections.
// If you feel tempted to add financial math, STOP.
//
// Reference: docs/doctrine/Pass2ReallyIs.md
// =============================================================================

import type { Pass2Input } from './pass2_input';

/**
 * Pass 2 Status — What can the pipeline do with this output?
 *
 * ELIGIBLE: All required constraints collected. Ready for Pass 3.
 * HOLD_INCOMPLETE: Missing critical constraints. Manual research required.
 * NO_GO: Fatal constraint violation. Site cannot be developed.
 */
export type Pass2Status = 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO';

/**
 * Buildability Envelope — Physical development limits
 *
 * This defines WHAT CAN FIT, not what should be built or how much it costs.
 */
export interface BuildabilityEnvelope {
  /**
   * Gross site acreage (from input or estimated)
   */
  gross_acres: number;

  /**
   * Net buildable acres after setbacks, easements, stormwater
   * null if cannot be calculated (missing constraints)
   */
  net_buildable_acres: number | null;

  /**
   * Maximum buildable sqft per acre based on constraints
   * Derived from: lot coverage, FAR, height limits, asset class efficiency
   */
  sqft_per_acre_ceiling: number | null;

  /**
   * Maximum total buildable sqft
   * = net_buildable_acres × sqft_per_acre_ceiling
   */
  max_buildable_sqft: number | null;

  /**
   * Whether the envelope could be calculated
   * false if critical constraints are missing
   */
  envelope_valid: boolean;

  /**
   * Reason envelope is invalid (if applicable)
   */
  envelope_invalid_reason?: string;
}

/**
 * Constraint Values — Raw geometric/regulatory limits
 *
 * All values are CONSTRAINT INPUTS, not calculations.
 * null means unknown/not yet researched.
 */
export interface ConstraintValues {
  // Zoning Constraints
  zoning_code: string | null;
  storage_allowed: boolean | null;
  conditional_use_required: boolean | null;

  // Setbacks (feet)
  setback_front_ft: number | null;
  setback_side_ft: number | null;
  setback_rear_ft: number | null;
  setback_combined_ft: number | null;

  // Coverage Limits (percentages)
  max_lot_coverage_pct: number | null;
  max_impervious_pct: number | null;
  max_building_height_ft: number | null;
  max_stories: number | null;
  floor_area_ratio: number | null;

  // Site Plan Constraints
  min_parking_spaces: number | null;
  ada_parking_required: boolean | null;
  landscape_buffer_ft: number | null;
  landscape_pct_required: number | null;

  // Fire Access Constraints
  fire_lane_width_ft: number | null;
  fire_lane_required: boolean | null;
  hydrant_spacing_ft: number | null;
  sprinkler_required: boolean | null;

  // Stormwater Constraints
  stormwater_required: boolean | null;
  detention_required: boolean | null;
  retention_required: boolean | null;
  infiltration_allowed: boolean | null;

  // Civil/Environmental
  flood_zone: string | null;
  wetlands_present: boolean | null;
  slope_limit_pct: number | null;
  soil_limitations: string | null;

  // Utilities
  water_available: boolean | null;
  sewer_available: boolean | null;
  electric_available: boolean | null;
  gas_available: boolean | null;
}

/**
 * Approval Checklist Item — What permits/approvals are needed
 */
export interface ApprovalItem {
  /**
   * Type of approval (e.g., "site_plan", "conditional_use", "building_permit")
   */
  type: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Is this approval required?
   */
  required: boolean;

  /**
   * Estimated difficulty (if known)
   */
  difficulty: 'easy' | 'moderate' | 'difficult' | 'unknown';

  /**
   * Source of this requirement
   */
  source: string;
}

/**
 * Unknown/Missing Data Item
 */
export interface UnknownItem {
  /**
   * Field that is unknown
   */
  field: string;

  /**
   * Why it matters
   */
  impact: string;

  /**
   * How to research it
   */
  research_method: string;

  /**
   * Does this block Pass 3 from running?
   * DOCTRINE: Unknown ≠ false. Missing data must propagate forward.
   */
  blocks_pass3: boolean;
}

/**
 * Provenance — Where did the constraint data come from?
 */
export interface Provenance {
  /**
   * ZIP code analyzed
   */
  zip_code: string;

  /**
   * Counties consulted for jurisdiction lookup
   */
  counties_consulted: string[];

  /**
   * Jurisdiction card IDs used
   */
  jurisdiction_cards_used: string[];

  /**
   * Whether Pass 0/1 data was used
   */
  derived_from_pass0: boolean;
  derived_from_pass1: boolean;

  /**
   * Timestamp of constraint compilation
   */
  compiled_at: string;

  /**
   * Data freshness warning if jurisdiction card is old
   */
  data_freshness_warning?: string;
}

/**
 * Pass 2 Output Contract — FROZEN
 *
 * DOCTRINE (ADR-019): Pass 2 returns NO conclusions, only facts.
 * This interface defines the ONLY outputs from Pass 2.
 * NO financial fields. NO revenue. NO timelines.
 *
 * A good Pass 2 makes Pass 3 boring.
 */
export interface Pass2Output {
  /**
   * Pass identifier
   */
  pass: 'PASS2';

  /**
   * Run ID for traceability
   */
  run_id: string;

  /**
   * Timestamp
   */
  timestamp: string;

  /**
   * Echo of input for audit
   */
  input: Pass2Input;

  /**
   * Pass 2 Status
   */
  status: Pass2Status;

  // ===========================================================================
  // DOCTRINE: Primary outputs — "Do we know enough to model this site?"
  // ===========================================================================

  /**
   * Is the jurisdiction card complete enough for Pass 3?
   * DOCTRINE: This is the PRIMARY signal from Pass 2.
   */
  jurisdiction_card_complete: boolean;

  /**
   * Which required fields are missing?
   * Pass 3 needs these before it can run.
   */
  required_fields_missing: string[];

  /**
   * Fatal prohibitions that make the site un-developable.
   * e.g., "Storage use is prohibited in this jurisdiction"
   */
  fatal_prohibitions: string[];

  /**
   * Buildability Envelope (physical limits)
   */
  buildability: BuildabilityEnvelope;

  /**
   * Raw constraint values
   */
  constraints: ConstraintValues;

  /**
   * Approval checklist (what permits are needed)
   */
  approval_checklist: ApprovalItem[];

  /**
   * Fatal flaws that make the site un-developable
   */
  fatal_flaws: string[];

  /**
   * Unknown/missing data requiring research
   */
  unknowns: UnknownItem[];

  /**
   * Does this require manual research before Pass 3?
   */
  manual_research_required: boolean;

  /**
   * Data provenance
   */
  provenance: Provenance;

  /**
   * Human-readable summary
   */
  summary: string;

  /**
   * Errors encountered during compilation
   */
  errors: string[];
}

/**
 * Create a default Pass 2 output for initialization.
 *
 * DOCTRINE: Default state is HOLD_INCOMPLETE with jurisdiction_card_complete: false.
 * Pass 2 must PROVE completeness, not assume it.
 */
export function createDefaultPass2Output(input: Pass2Input): Pass2Output {
  return {
    pass: 'PASS2',
    run_id: input.run_id,
    timestamp: new Date().toISOString(),
    input,
    status: 'HOLD_INCOMPLETE',

    // DOCTRINE: Primary signals — default to incomplete
    jurisdiction_card_complete: false,
    required_fields_missing: ['ALL — card not yet researched'],
    fatal_prohibitions: [],

    buildability: {
      gross_acres: input.requested_acres ?? 0,
      net_buildable_acres: null,
      sqft_per_acre_ceiling: null,
      max_buildable_sqft: null,
      envelope_valid: false,
      envelope_invalid_reason: 'Constraints not yet compiled',
    },
    constraints: {
      zoning_code: null,
      storage_allowed: null,
      conditional_use_required: null,
      setback_front_ft: null,
      setback_side_ft: null,
      setback_rear_ft: null,
      setback_combined_ft: null,
      max_lot_coverage_pct: null,
      max_impervious_pct: null,
      max_building_height_ft: null,
      max_stories: null,
      floor_area_ratio: null,
      min_parking_spaces: null,
      ada_parking_required: null,
      landscape_buffer_ft: null,
      landscape_pct_required: null,
      fire_lane_width_ft: null,
      fire_lane_required: null,
      hydrant_spacing_ft: null,
      sprinkler_required: null,
      stormwater_required: null,
      detention_required: null,
      retention_required: null,
      infiltration_allowed: null,
      flood_zone: null,
      wetlands_present: null,
      slope_limit_pct: null,
      soil_limitations: null,
      water_available: null,
      sewer_available: null,
      electric_available: null,
      gas_available: null,
    },
    approval_checklist: [],
    fatal_flaws: [],
    unknowns: [],
    manual_research_required: true,
    provenance: {
      zip_code: input.zip_code,
      counties_consulted: [],
      jurisdiction_cards_used: [],
      derived_from_pass0: false,
      derived_from_pass1: false,
      compiled_at: new Date().toISOString(),
    },
    summary: 'Constraint compilation pending',
    errors: [],
  };
}
