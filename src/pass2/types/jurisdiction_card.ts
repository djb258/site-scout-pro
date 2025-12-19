/**
 * Pass 2 — Jurisdiction Card Types
 * ============================================================================
 *
 * ✅ SAFE FOR UI/LOVABLE — TYPES ONLY
 *
 * This module contains type definitions only. No write operations.
 * Safe to import anywhere.
 *
 * ============================================================================
 *
 * DOCTRINE:
 * This file represents ONE PAPER CARD PER COUNTY that a planner might
 * have filled out by hand.
 *
 * - Pass 2 defines WHAT is true
 * - Data may be known or unknown
 * - Absence of data is meaningful
 * - Pass 3 consumes this data without reinterpretation
 *
 * If a planner would write it on paper, it belongs here.
 * If it is a calculation or derived value, it belongs in Pass 3.
 *
 * ============================================================================
 */

// =============================================================================
// PRIMITIVE TYPES
// =============================================================================

/**
 * Ternary knowledge state for boolean-like fields.
 * DOCTRINE: Unknown is valid and expected.
 */
export type Ternary = 'yes' | 'no' | 'unknown';

/**
 * Knowledge state for any field.
 */
export type KnowledgeState = 'known' | 'unknown' | 'blocked';

/**
 * Source type for provenance tracking.
 */
export type SourceType = 'ordinance' | 'pdf' | 'portal' | 'human';

/**
 * Authority scope - who has jurisdiction.
 */
export type AuthorityScope = 'county' | 'municipal' | 'fire_district' | 'state';

/**
 * Authority model - how jurisdiction is structured.
 */
export type AuthorityModel = 'county' | 'municipal' | 'mixed' | 'none';

/**
 * Zoning model - how zoning is structured.
 */
export type ZoningModel = 'no_zoning' | 'county' | 'municipal' | 'mixed';

/**
 * Asset class being evaluated.
 */
export type AssetClass = 'self_storage' | 'rv_storage' | 'trailer_yard' | 'boat_storage' | 'other';

// =============================================================================
// PROVENANCE (REQUIRED FOR ALL FIELDS)
// =============================================================================

/**
 * Provenance record for a single field value.
 * EVERY populated field must have this.
 */
export interface FieldProvenance {
  /** The actual value */
  value: string | number | boolean | null;

  /** Unit of measurement (if applicable) */
  unit: string | null;

  /** Knowledge state */
  knowledge_state: KnowledgeState;

  /** Source type */
  source_type: SourceType | null;

  /** Source reference (URL, document, section, page) */
  source_reference: string | null;

  /** Authority scope */
  authority_scope: AuthorityScope | null;

  /** When this was verified */
  verified_at: string | null;

  /** When this should be revalidated */
  ttl_date: string | null;
}

/**
 * Numeric field with provenance.
 * DOCTRINE: All numeric fields must allow unknown.
 */
export interface NumericField extends FieldProvenance {
  value: number | null;
  unit: 'ft' | '%' | 'stories' | 'spaces' | 'sqft' | null;
}

/**
 * Ternary field with provenance.
 */
export interface TernaryField extends FieldProvenance {
  value: Ternary;
}

/**
 * Text field with provenance.
 */
export interface TextField extends FieldProvenance {
  value: string | null;
}

// =============================================================================
// A. JURISDICTION IDENTITY & SCOPE
// =============================================================================

export interface JurisdictionScope {
  /** County name */
  county_name: string;

  /** State code (e.g., 'TX', 'FL') */
  state: string;

  /** County FIPS code */
  county_fips: string;

  /** Asset class being evaluated */
  asset_class: AssetClass;

  /** Authority model (the FACT about who governs) */
  authority_model: AuthorityModel | null;
  authority_model_state: KnowledgeState;
  authority_model_source: SourceType | null;
  authority_model_ref: string | null;

  /** Zoning model (the FACT about zoning structure) */
  zoning_model: ZoningModel | null;
  zoning_model_state: KnowledgeState;
  zoning_model_source: SourceType | null;
  zoning_model_ref: string | null;

  /** Controlling authority name */
  controlling_authority_name: TextField;

  /** Controlling authority contact (dept / phone / email) */
  controlling_authority_contact: TextField;
}

// =============================================================================
// B. USE VIABILITY (BINARY GATING)
// =============================================================================

/**
 * Use viability section.
 * DOCTRINE: These fields answer "should we even continue?"
 */
export interface UseViability {
  /** Storage allowed somewhere in county */
  storage_allowed: TernaryField;

  /** Fatal prohibition present */
  fatal_prohibition_present: TernaryField;

  /** Fatal prohibition description */
  fatal_prohibition_description: TextField;

  /** Conditional use permit required */
  conditional_use_required: TernaryField;

  /** Discretionary / board approval required */
  discretionary_approval_required: TernaryField;

  /** General zoning notes */
  general_notes: TextField;
}

// =============================================================================
// C. ZONING ENVELOPE (REQUIRED_FOR_ENVELOPE)
// =============================================================================

/**
 * Setbacks section.
 */
export interface Setbacks {
  /** Minimum front setback (ft) */
  front: NumericField;

  /** Minimum side setback (ft) */
  side: NumericField;

  /** Minimum rear setback (ft) */
  rear: NumericField;
}

/**
 * Coverage / Intensity section.
 */
export interface CoverageIntensity {
  /** Maximum lot coverage (%) */
  max_lot_coverage: NumericField;

  /** Maximum floor area ratio (FAR) */
  max_far: NumericField;

  /** Minimum open space (%) */
  min_open_space: NumericField;

  /** Maximum building height (ft) */
  max_height: NumericField;

  /** Maximum number of stories */
  max_stories: NumericField;
}

/**
 * Buffers section.
 */
export interface Buffers {
  /** Residential buffer (ft) */
  residential: NumericField;

  /** Waterway buffer (ft) */
  waterway: NumericField;

  /** Roadway buffer (ft) */
  roadway: NumericField;
}

/**
 * Zoning envelope - REQUIRED_FOR_ENVELOPE.
 * DOCTRINE: These are the minimum numeric constraints required
 * to compute buildable geometry.
 */
export interface ZoningEnvelope {
  setbacks: Setbacks;
  coverage: CoverageIntensity;
  buffers: Buffers;
}

// =============================================================================
// D. FIRE & LIFE SAFETY
// =============================================================================

/**
 * Fire & Life Safety section.
 * DOCTRINE: Constraints affecting layout, circulation, and building footprint.
 */
export interface FireLifeSafety {
  /** Fire lane required */
  fire_lane_required: TernaryField;

  /** Minimum fire lane width (ft) */
  min_fire_lane_width: NumericField;

  /** Maximum hydrant spacing (ft) */
  max_hydrant_spacing: NumericField;

  /** Fire department access required */
  fire_dept_access_required: TernaryField;

  /** Sprinkler required */
  sprinkler_required: TernaryField;

  /** Adopted fire code (e.g., IFC 2018) */
  adopted_fire_code: TextField;
}

// =============================================================================
// E. STORMWATER & ENVIRONMENTAL
// =============================================================================

/**
 * Stormwater & Environmental section.
 * DOCTRINE: Constraints that reduce usable acreage.
 */
export interface StormwaterEnvironmental {
  /** Stormwater detention required */
  detention_required: TernaryField;

  /** Stormwater retention required */
  retention_required: TernaryField;

  /** Maximum impervious surface (%) */
  max_impervious: NumericField;

  /** Watershed overlay present */
  watershed_overlay: TernaryField;

  /** Floodplain overlay present */
  floodplain_overlay: TernaryField;

  /** Environmental notes */
  environmental_notes: TextField;
}

// =============================================================================
// F. PARKING & ACCESS
// =============================================================================

/**
 * Parking & Access section.
 * DOCTRINE: Collected when applicable to the asset class.
 */
export interface ParkingAccess {
  /** Parking required */
  parking_required: TernaryField;

  /** Parking ratio (spaces per sq ft or unit) */
  parking_ratio: NumericField;

  /** Truck access required */
  truck_access_required: TernaryField;

  /** Minimum driveway width (ft) */
  min_driveway_width: NumericField;
}

// =============================================================================
// COMPLETE JURISDICTION CARD
// =============================================================================

/**
 * Complete Jurisdiction Card for a single county.
 *
 * DOCTRINE:
 * - This is county-scoped, not parcel-scoped
 * - Pass 3 consumes this data without reinterpretation
 * - No numeric value may be inferred
 * - Unknown is valid and expected
 * - REQUIRED_FOR_ENVELOPE fields must be known for Pass 3 geometry
 */
export interface JurisdictionCard {
  /** Section A: Jurisdiction Scope (who governs, at what level) */
  scope: JurisdictionScope;

  /** Section B: Use Viability (Binary Gating) */
  use_viability: UseViability;

  /** Section C: Zoning Envelope (REQUIRED_FOR_ENVELOPE) */
  zoning_envelope: ZoningEnvelope;

  /** Section D: Fire & Life Safety */
  fire_life_safety: FireLifeSafety;

  /** Section E: Stormwater & Environmental */
  stormwater_environmental: StormwaterEnvironmental;

  /** Section F: Parking & Access */
  parking_access: ParkingAccess;

  /** Card metadata */
  meta: {
    /** When this card was created */
    created_at: string;

    /** When this card was last updated */
    updated_at: string;

    /** Version for optimistic locking */
    version: number;

    /** Is this card complete enough for Pass 3? */
    envelope_complete: boolean;
  };
}

// =============================================================================
// ENFORCEMENT RULES (as code)
// =============================================================================

/**
 * Fields required for envelope calculation.
 * If any of these are unknown, Pass 3 cannot compute geometry.
 */
export const REQUIRED_FOR_ENVELOPE: (keyof ZoningEnvelope['setbacks'] | keyof ZoningEnvelope['coverage'])[] = [
  'front',
  'side',
  'rear',
  'max_lot_coverage',
  'max_height',
];

/**
 * Check if a jurisdiction card has enough data for Pass 3 geometry.
 */
export function isEnvelopeComplete(card: JurisdictionCard): boolean {
  const { setbacks, coverage } = card.zoning_envelope;

  // All required setbacks must be known
  if (setbacks.front.knowledge_state !== 'known') return false;
  if (setbacks.side.knowledge_state !== 'known') return false;
  if (setbacks.rear.knowledge_state !== 'known') return false;

  // Required coverage fields must be known
  if (coverage.max_lot_coverage.knowledge_state !== 'known') return false;
  if (coverage.max_height.knowledge_state !== 'known') return false;

  return true;
}

/**
 * Check if a jurisdiction card has a fatal prohibition.
 */
export function hasFatalProhibition(card: JurisdictionCard): boolean {
  return card.use_viability.fatal_prohibition_present.value === 'yes';
}

/**
 * Check if storage is allowed in this jurisdiction.
 */
export function isStorageAllowed(card: JurisdictionCard): Ternary {
  return card.use_viability.storage_allowed.value;
}
