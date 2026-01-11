/**
 * Pass 2 Database Types
 * TypeScript types matching the Neon pass2 schema tables
 *
 * Source: supabase/migrations/20251218_pass2_jurisdiction_cards.sql
 * Doctrine: ADR-019 (Pass 2 = Jurisdiction Card Completion Engine)
 */

// =============================================================================
// ENUM TYPES (match PostgreSQL ENUMs)
// =============================================================================

/**
 * Criticality levels for constraint fields
 * Determines whether a field blocks envelope calculation or approval
 */
export type ConstraintCriticalityDB =
  | 'REQUIRED_FOR_ENVELOPE'   // Must be known for buildability calculation
  | 'REQUIRED_FOR_APPROVAL'   // Must be known before permitting
  | 'INFORMATIONAL';          // Nice to have, does not block anything

/**
 * Field knowledge states
 * Represents what we know about a constraint value
 */
export type KnowledgeStateDB =
  | 'known'    // Value confirmed and trustworthy
  | 'unknown'  // Value has not been researched
  | 'blocked'; // Research attempted, value could not be determined

/**
 * Authority scope types
 * Which governing body owns this constraint
 */
export type AuthorityScopeDB =
  | 'county'
  | 'municipality'
  | 'watershed'
  | 'state'
  | 'fire_district'
  | 'dot'
  | 'utility'
  | 'unknown';

// =============================================================================
// TABLE TYPES
// =============================================================================

/**
 * Jurisdiction Card (Root Table)
 * One row per (county × asset_class) combination
 *
 * Table: pass2.jurisdiction_cards
 */
export interface JurisdictionCardRow {
  jurisdiction_card_id: string;  // UUID
  county_id: number;             // FK to ref.ref_county
  asset_class_id: number;        // FK to ref.ref_asset_class

  // PRIMARY signal for Pass 3
  jurisdiction_card_complete: boolean;

  // Metadata
  created_at: string;   // TIMESTAMPTZ
  updated_at: string;   // TIMESTAMPTZ
  created_by: string | null;
  updated_by: string | null;

  // Optimistic locking
  version: number;
}

/**
 * Insert type for jurisdiction_cards (without auto-generated fields)
 */
export interface JurisdictionCardInsert {
  county_id: number;
  asset_class_id: number;
  jurisdiction_card_complete?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
}

/**
 * Update type for jurisdiction_cards
 */
export interface JurisdictionCardUpdate {
  jurisdiction_card_complete?: boolean;
  updated_by?: string | null;
}

// -----------------------------------------------------------------------------

/**
 * Jurisdiction Constraint (Field-Level Constants)
 * One row per constraint field per card
 *
 * Table: pass2.jurisdiction_constraints
 */
export interface JurisdictionConstraintRow {
  constraint_id: string;          // UUID
  jurisdiction_card_id: string;   // FK to jurisdiction_cards

  // Constraint identity
  constraint_key: string;         // Canonical name (e.g., 'front_setback_ft')
  constraint_value: unknown;      // JSONB - null if unknown/blocked

  // Criticality and knowledge state
  criticality: ConstraintCriticalityDB;
  knowledge_state: KnowledgeStateDB;

  // Authority and provenance
  authority_scope: AuthorityScopeDB;
  verified_at: string | null;     // TIMESTAMPTZ
  revalidation_required: boolean;
  source: string | null;
  notes: string | null;

  // Metadata
  created_at: string;   // TIMESTAMPTZ
  updated_at: string;   // TIMESTAMPTZ
}

/**
 * Insert type for jurisdiction_constraints
 */
export interface JurisdictionConstraintInsert {
  jurisdiction_card_id: string;
  constraint_key: string;
  constraint_value?: unknown;
  criticality: ConstraintCriticalityDB;
  knowledge_state?: KnowledgeStateDB;
  authority_scope?: AuthorityScopeDB;
  verified_at?: string | null;
  revalidation_required?: boolean;
  source?: string | null;
  notes?: string | null;
}

/**
 * Update type for jurisdiction_constraints
 */
export interface JurisdictionConstraintUpdate {
  constraint_value?: unknown;
  knowledge_state?: KnowledgeStateDB;
  authority_scope?: AuthorityScopeDB;
  verified_at?: string | null;
  revalidation_required?: boolean;
  source?: string | null;
  notes?: string | null;
}

// -----------------------------------------------------------------------------

/**
 * Jurisdiction Prohibition (Fatal Blockers)
 * Explicit fatal blockers that make site un-developable
 *
 * Table: pass2.jurisdiction_prohibitions
 */
export interface JurisdictionProhibitionRow {
  prohibition_id: string;         // UUID
  jurisdiction_card_id: string;   // FK to jurisdiction_cards

  // Prohibition details
  prohibition_code: string;       // e.g., 'STORAGE_PROHIBITED'
  description: string;

  // Authority and provenance
  authority_scope: AuthorityScopeDB;
  verified_at: string | null;     // TIMESTAMPTZ
  source: string | null;

  // Metadata
  created_at: string;   // TIMESTAMPTZ
}

/**
 * Insert type for jurisdiction_prohibitions
 */
export interface JurisdictionProhibitionInsert {
  jurisdiction_card_id: string;
  prohibition_code: string;
  description: string;
  authority_scope?: AuthorityScopeDB;
  verified_at?: string | null;
  source?: string | null;
}

// -----------------------------------------------------------------------------

/**
 * Jurisdiction Permit Requirements (Checklist, Not Timelines)
 * What permits are needed (existence, not duration)
 *
 * Table: pass2.jurisdiction_permit_requirements
 */
export interface JurisdictionPermitRequirementRow {
  permit_id: string;              // UUID
  jurisdiction_card_id: string;   // FK to jurisdiction_cards

  // Permit details
  permit_name: string;
  issuing_authority: string;
  required: boolean;

  // Authority and provenance
  authority_scope: AuthorityScopeDB;
  notes: string | null;

  // Metadata
  created_at: string;   // TIMESTAMPTZ
}

/**
 * Insert type for jurisdiction_permit_requirements
 */
export interface JurisdictionPermitRequirementInsert {
  jurisdiction_card_id: string;
  permit_name: string;
  issuing_authority: string;
  required?: boolean;
  authority_scope?: AuthorityScopeDB;
  notes?: string | null;
}

// -----------------------------------------------------------------------------

/**
 * Reference Constraint Keys
 * Canonical constraint keys - do not add without doctrine change
 *
 * Table: pass2.ref_constraint_keys
 */
export interface RefConstraintKeyRow {
  constraint_key: string;         // PRIMARY KEY
  criticality: ConstraintCriticalityDB;
  description: string | null;
  unit: string | null;
  value_type: 'number' | 'boolean' | 'text';
}

// =============================================================================
// VIEW TYPES
// =============================================================================

/**
 * Jurisdiction Card Summary View
 * Aggregated view with completeness metrics
 *
 * View: pass2.jurisdiction_card_summary
 */
export interface JurisdictionCardSummaryView {
  jurisdiction_card_id: string;
  county_id: number;
  county_name: string;
  state_code: string;
  asset_class_id: number;
  asset_class_code: string;
  jurisdiction_card_complete: boolean;
  created_at: string;
  updated_at: string;

  // Counts by knowledge state
  known_count: number;
  unknown_count: number;
  blocked_count: number;
  stale_count: number;

  // Required for envelope tracking
  envelope_known_count: number;
  envelope_total_count: number;

  // Prohibitions
  prohibition_count: number;
}

// =============================================================================
// CANONICAL CONSTRAINT KEYS (TypeScript enum for type safety)
// =============================================================================

/**
 * Canonical constraint keys for jurisdiction_constraints
 * DOCTRINE: Do NOT add keys without explicit doctrine change
 */
export const CANONICAL_CONSTRAINT_KEYS = {
  // REQUIRED_FOR_ENVELOPE (Geometry)
  FRONT_SETBACK_FT: 'front_setback_ft',
  SIDE_SETBACK_FT: 'side_setback_ft',
  REAR_SETBACK_FT: 'rear_setback_ft',
  MAX_LOT_COVERAGE_PCT: 'max_lot_coverage_pct',
  MAX_IMPERVIOUS_PCT: 'max_impervious_pct',
  BUFFER_WIDTH_FT: 'buffer_width_ft',
  SLOPE_EXCLUSION_PCT: 'slope_exclusion_pct',
  FLOODPLAIN_EXCLUSION: 'floodplain_exclusion',
  FIRE_LANE_WIDTH_FT: 'fire_lane_width_ft',
  ADA_PARKING_RATIO: 'ada_parking_ratio',
  STORMWATER_RESERVATION_FACTOR: 'stormwater_reservation_factor',
  MAX_HEIGHT_FT: 'max_height_ft',
  MAX_STORIES: 'max_stories',
  FLOOR_AREA_RATIO: 'floor_area_ratio',

  // REQUIRED_FOR_APPROVAL
  STORAGE_BY_RIGHT: 'storage_by_right',
  CONDITIONAL_USE_REQUIRED: 'conditional_use_required',
  BONDING_REQUIRED: 'bonding_required',
  SPECIAL_STUDIES_REQUIRED: 'special_studies_required',
  APPROVALS_REQUIRED: 'approvals_required',

  // INFORMATIONAL
  PERMIT_PATH_TYPE: 'permit_path_type',
  STORAGE_CODE_REFERENCE: 'storage_code_reference',
  INSPECTION_REGIME_NOTES: 'inspection_regime_notes',
  LANDSCAPE_PCT_REQUIRED: 'landscape_pct_required',
  HYDRANT_SPACING_FT: 'hydrant_spacing_ft',
  SPRINKLER_REQUIRED: 'sprinkler_required',
  DETENTION_REQUIRED: 'detention_required',
  RETENTION_REQUIRED: 'retention_required',
  INFILTRATION_ALLOWED: 'infiltration_allowed',
} as const;

export type CanonicalConstraintKey = typeof CANONICAL_CONSTRAINT_KEYS[keyof typeof CANONICAL_CONSTRAINT_KEYS];

/**
 * Constraint keys required for envelope calculation
 * If ANY of these are unknown, EnvelopeReducer refuses to calculate
 */
export const REQUIRED_FOR_ENVELOPE_KEYS: CanonicalConstraintKey[] = [
  CANONICAL_CONSTRAINT_KEYS.FRONT_SETBACK_FT,
  CANONICAL_CONSTRAINT_KEYS.SIDE_SETBACK_FT,
  CANONICAL_CONSTRAINT_KEYS.REAR_SETBACK_FT,
  CANONICAL_CONSTRAINT_KEYS.MAX_LOT_COVERAGE_PCT,
  CANONICAL_CONSTRAINT_KEYS.MAX_IMPERVIOUS_PCT,
  CANONICAL_CONSTRAINT_KEYS.BUFFER_WIDTH_FT,
  CANONICAL_CONSTRAINT_KEYS.SLOPE_EXCLUSION_PCT,
  CANONICAL_CONSTRAINT_KEYS.FLOODPLAIN_EXCLUSION,
  CANONICAL_CONSTRAINT_KEYS.FIRE_LANE_WIDTH_FT,
  CANONICAL_CONSTRAINT_KEYS.ADA_PARKING_RATIO,
  CANONICAL_CONSTRAINT_KEYS.STORMWATER_RESERVATION_FACTOR,
  CANONICAL_CONSTRAINT_KEYS.MAX_HEIGHT_FT,
  CANONICAL_CONSTRAINT_KEYS.MAX_STORIES,
  CANONICAL_CONSTRAINT_KEYS.FLOOR_AREA_RATIO,
];

// =============================================================================
// HELPER TYPES FOR QUERIES
// =============================================================================

/**
 * Query result when fetching a card with all its constraints
 */
export interface JurisdictionCardWithConstraints {
  card: JurisdictionCardRow;
  constraints: JurisdictionConstraintRow[];
  prohibitions: JurisdictionProhibitionRow[];
  permits: JurisdictionPermitRequirementRow[];
}

/**
 * Lookup parameters for finding a jurisdiction card
 */
export interface JurisdictionCardLookup {
  county_id: number;
  asset_class_id: number;
}

/**
 * Alternative lookup by names (requires join to ref tables)
 */
export interface JurisdictionCardLookupByName {
  state_code: string;
  county_name: string;
  asset_class_code: 'self_storage' | 'rv_storage' | 'boat_storage';
}
