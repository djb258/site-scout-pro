/**
 * Jurisdiction Card Factory
 * ============================================================================
 *
 * DOCTRINE:
 * Creates empty jurisdiction cards with all fields initialized to unknown.
 * Unknown is valid and expected.
 *
 * ============================================================================
 */

import {
  JurisdictionCard,
  JurisdictionScope,
  UseViability,
  ZoningEnvelope,
  FireLifeSafety,
  StormwaterEnvironmental,
  ParkingAccess,
  NumericField,
  TernaryField,
  TextField,
  AssetClass,
  KnowledgeState,
} from '../types/jurisdiction_card';

// =============================================================================
// FIELD FACTORIES
// =============================================================================

/**
 * Create an unknown numeric field.
 */
export function createUnknownNumeric(): NumericField {
  return {
    value: null,
    unit: null,
    knowledge_state: 'unknown',
    source_type: null,
    source_reference: null,
    authority_scope: null,
    verified_at: null,
    ttl_date: null,
  };
}

/**
 * Create an unknown ternary field.
 */
export function createUnknownTernary(): TernaryField {
  return {
    value: 'unknown',
    unit: null,
    knowledge_state: 'unknown',
    source_type: null,
    source_reference: null,
    authority_scope: null,
    verified_at: null,
    ttl_date: null,
  };
}

/**
 * Create an unknown text field.
 */
export function createUnknownText(): TextField {
  return {
    value: null,
    unit: null,
    knowledge_state: 'unknown',
    source_type: null,
    source_reference: null,
    authority_scope: null,
    verified_at: null,
    ttl_date: null,
  };
}

// =============================================================================
// SECTION FACTORIES
// =============================================================================

function createEmptyUseViability(): UseViability {
  return {
    storage_allowed: createUnknownTernary(),
    fatal_prohibition_present: createUnknownTernary(),
    fatal_prohibition_description: createUnknownText(),
    conditional_use_required: createUnknownTernary(),
    discretionary_approval_required: createUnknownTernary(),
    general_notes: createUnknownText(),
  };
}

function createEmptyZoningEnvelope(): ZoningEnvelope {
  return {
    setbacks: {
      front: createUnknownNumeric(),
      side: createUnknownNumeric(),
      rear: createUnknownNumeric(),
    },
    coverage: {
      max_lot_coverage: createUnknownNumeric(),
      max_far: createUnknownNumeric(),
      min_open_space: createUnknownNumeric(),
      max_height: createUnknownNumeric(),
      max_stories: createUnknownNumeric(),
    },
    buffers: {
      residential: createUnknownNumeric(),
      waterway: createUnknownNumeric(),
      roadway: createUnknownNumeric(),
    },
  };
}

function createEmptyFireLifeSafety(): FireLifeSafety {
  return {
    fire_lane_required: createUnknownTernary(),
    min_fire_lane_width: createUnknownNumeric(),
    max_hydrant_spacing: createUnknownNumeric(),
    fire_dept_access_required: createUnknownTernary(),
    sprinkler_required: createUnknownTernary(),
    adopted_fire_code: createUnknownText(),
  };
}

function createEmptyStormwaterEnvironmental(): StormwaterEnvironmental {
  return {
    detention_required: createUnknownTernary(),
    retention_required: createUnknownTernary(),
    max_impervious: createUnknownNumeric(),
    watershed_overlay: createUnknownTernary(),
    floodplain_overlay: createUnknownTernary(),
    environmental_notes: createUnknownText(),
  };
}

function createEmptyParkingAccess(): ParkingAccess {
  return {
    parking_required: createUnknownTernary(),
    parking_ratio: createUnknownNumeric(),
    truck_access_required: createUnknownTernary(),
    min_driveway_width: createUnknownNumeric(),
  };
}

// =============================================================================
// CARD FACTORY
// =============================================================================

export interface CreateJurisdictionCardInput {
  county_name: string;
  state: string;
  county_fips: string;
  asset_class?: AssetClass;
}

/**
 * Create an empty jurisdiction card for a county.
 * All fields initialized to unknown.
 */
export function createEmptyJurisdictionCard(
  input: CreateJurisdictionCardInput
): JurisdictionCard {
  const now = new Date().toISOString();

  const scope: JurisdictionScope = {
    county_name: input.county_name,
    state: input.state,
    county_fips: input.county_fips,
    asset_class: input.asset_class ?? 'self_storage',
    // Authority model - unknown until hydrated
    authority_model: null,
    authority_model_state: 'unknown',
    authority_model_source: null,
    authority_model_ref: null,
    // Zoning model - unknown until hydrated
    zoning_model: null,
    zoning_model_state: 'unknown',
    zoning_model_source: null,
    zoning_model_ref: null,
    // Controlling authority
    controlling_authority_name: createUnknownText(),
    controlling_authority_contact: createUnknownText(),
  };

  return {
    scope,
    use_viability: createEmptyUseViability(),
    zoning_envelope: createEmptyZoningEnvelope(),
    fire_life_safety: createEmptyFireLifeSafety(),
    stormwater_environmental: createEmptyStormwaterEnvironmental(),
    parking_access: createEmptyParkingAccess(),
    meta: {
      created_at: now,
      updated_at: now,
      version: 1,
      envelope_complete: false,
    },
  };
}

// =============================================================================
// FIELD UPDATE HELPERS
// =============================================================================

export interface UpdateNumericFieldInput {
  value: number;
  unit: NumericField['unit'];
  source_type: NumericField['source_type'];
  source_reference: string;
  authority_scope: NumericField['authority_scope'];
}

/**
 * Create a known numeric field with provenance.
 */
export function createKnownNumeric(input: UpdateNumericFieldInput): NumericField {
  return {
    value: input.value,
    unit: input.unit,
    knowledge_state: 'known',
    source_type: input.source_type,
    source_reference: input.source_reference,
    authority_scope: input.authority_scope,
    verified_at: new Date().toISOString(),
    ttl_date: null, // Set based on TTL policy
  };
}

export interface UpdateTernaryFieldInput {
  value: 'yes' | 'no';
  source_type: TernaryField['source_type'];
  source_reference: string;
  authority_scope: TernaryField['authority_scope'];
}

/**
 * Create a known ternary field with provenance.
 */
export function createKnownTernary(input: UpdateTernaryFieldInput): TernaryField {
  return {
    value: input.value,
    unit: null,
    knowledge_state: 'known',
    source_type: input.source_type,
    source_reference: input.source_reference,
    authority_scope: input.authority_scope,
    verified_at: new Date().toISOString(),
    ttl_date: null,
  };
}

export interface UpdateTextFieldInput {
  value: string;
  source_type: TextField['source_type'];
  source_reference: string;
  authority_scope: TextField['authority_scope'];
}

/**
 * Create a known text field with provenance.
 */
export function createKnownText(input: UpdateTextFieldInput): TextField {
  return {
    value: input.value,
    unit: null,
    knowledge_state: 'known',
    source_type: input.source_type,
    source_reference: input.source_reference,
    authority_scope: input.authority_scope,
    verified_at: new Date().toISOString(),
    ttl_date: null,
  };
}
