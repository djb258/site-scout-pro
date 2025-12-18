// =============================================================================
// PASS 2 GUARDRAIL TYPES
// =============================================================================
// Purpose: Enforce Pass 2 doctrine through type-safe guardrails
// Reference: ADR-019, docs/doctrine/Pass2ReallyIs.md
//
// These types ensure:
// 1. No silent partial envelopes (criticality enforcement)
// 2. No stale data masquerading as current (staleness guard)
// 3. No false completeness inference (authority scope)
// =============================================================================

// =============================================================================
// 1. FIELD CRITICALITY
// =============================================================================

/**
 * Criticality level for constraint fields.
 *
 * REQUIRED_FOR_ENVELOPE: Must be known to calculate buildable area.
 *                        EnvelopeReducer REFUSES if unknown/blocked.
 * REQUIRED_FOR_APPROVAL: Must be known before permitting.
 *                        Does not block envelope but blocks ELIGIBLE.
 * INFORMATIONAL: Nice to have. Does not block anything.
 */
export type ConstraintCriticality =
  | 'REQUIRED_FOR_ENVELOPE'
  | 'REQUIRED_FOR_APPROVAL'
  | 'INFORMATIONAL';

/**
 * Field knowledge state.
 *
 * known: Value is confirmed and trustworthy.
 * unknown: Value has not been researched.
 * blocked: Research attempted but value could not be determined.
 */
export type FieldKnowledgeState = 'known' | 'unknown' | 'blocked';

/**
 * A constraint field with full metadata.
 */
export interface ConstraintField<T> {
  /** The actual value (null if unknown/blocked) */
  value: T | null;

  /** Knowledge state */
  state: FieldKnowledgeState;

  /** How critical is this field? */
  criticality: ConstraintCriticality;

  /** Source of the value */
  source: string | null;

  /** Authority scope that provided this value */
  authority_scope: AuthorityScope;

  /** When was this value last verified? */
  verified_at: string | null;

  /** Does this value need revalidation? */
  revalidation_required: boolean;
}

// =============================================================================
// 2. STALENESS / REVALIDATION GUARD
// =============================================================================

/**
 * Staleness metadata for constraint values.
 * Prevents old jurisdiction cards from masquerading as current truth.
 */
export interface StalenessMetadata {
  /** ISO timestamp of last verification */
  verified_at: string | null;

  /** Flag indicating revalidation is needed */
  revalidation_required: boolean;
}

/**
 * Check if a field should be treated as unknown due to staleness.
 *
 * DOCTRINE: If revalidation_required = true, treat as unknown.
 */
export function isEffectivelyUnknown(field: ConstraintField<any>): boolean {
  // If already unknown or blocked, it's unknown
  if (field.state === 'unknown' || field.state === 'blocked') {
    return true;
  }

  // If revalidation required, treat as unknown
  if (field.revalidation_required) {
    return true;
  }

  return false;
}

// =============================================================================
// 3. AUTHORITY SCOPE
// =============================================================================

/**
 * Authority scope that may provide constraint values.
 *
 * Completeness must be checked per authority, not global.
 */
export type AuthorityScope =
  | 'county'
  | 'municipality'
  | 'watershed'
  | 'state'
  | 'fire_district'
  | 'dot'
  | 'utility'
  | 'unknown';

/**
 * Record of which authorities were consulted.
 */
export interface AuthoritiesConsulted {
  county: boolean;
  municipality: boolean;
  watershed: boolean;
  state: boolean;
  fire_district: boolean;
  dot: boolean;
  utility: boolean;
}

/**
 * Create default authorities consulted (all false).
 */
export function createDefaultAuthoritiesConsulted(): AuthoritiesConsulted {
  return {
    county: false,
    municipality: false,
    watershed: false,
    state: false,
    fire_district: false,
    dot: false,
    utility: false,
  };
}

// =============================================================================
// ENVELOPE ENFORCEMENT
// =============================================================================

/**
 * Fields required for envelope calculation.
 * If ANY of these are effectively unknown, EnvelopeReducer MUST refuse.
 */
export const REQUIRED_FOR_ENVELOPE_FIELDS: string[] = [
  'setback_front_ft',
  'setback_side_ft',
  'setback_rear_ft',
  'max_lot_coverage_pct',
  'stormwater_plan_required',
  'fire_lane_required',
];

/**
 * Result of checking envelope requirements.
 */
export interface EnvelopeRequirementCheck {
  /** Can envelope be calculated? */
  can_calculate: boolean;

  /** Fields that are missing (unknown/blocked/stale) */
  missing_required_fields: string[];

  /** Fields that need revalidation */
  stale_fields: string[];

  /** Reason envelope cannot be calculated (if applicable) */
  block_reason: string | null;
}

/**
 * Check if envelope can be calculated given constraint fields.
 *
 * DOCTRINE: EnvelopeReducer MUST refuse if any REQUIRED_FOR_ENVELOPE
 * field is unknown, blocked, or requires revalidation.
 */
export function checkEnvelopeRequirements(
  fields: Record<string, ConstraintField<any>>
): EnvelopeRequirementCheck {
  const missingFields: string[] = [];
  const staleFields: string[] = [];

  for (const fieldName of REQUIRED_FOR_ENVELOPE_FIELDS) {
    const field = fields[fieldName];

    if (!field) {
      missingFields.push(fieldName);
      continue;
    }

    if (field.criticality !== 'REQUIRED_FOR_ENVELOPE') {
      // Field exists but isn't marked as required — configuration error
      continue;
    }

    if (isEffectivelyUnknown(field)) {
      if (field.revalidation_required && field.state === 'known') {
        staleFields.push(fieldName);
      } else {
        missingFields.push(fieldName);
      }
    }
  }

  const canCalculate = missingFields.length === 0 && staleFields.length === 0;

  let blockReason: string | null = null;
  if (!canCalculate) {
    const reasons: string[] = [];
    if (missingFields.length > 0) {
      reasons.push(`Missing required fields: ${missingFields.join(', ')}`);
    }
    if (staleFields.length > 0) {
      reasons.push(`Stale fields requiring revalidation: ${staleFields.join(', ')}`);
    }
    blockReason = reasons.join('; ');
  }

  return {
    can_calculate: canCalculate,
    missing_required_fields: missingFields,
    stale_fields: staleFields,
    block_reason: blockReason,
  };
}

// =============================================================================
// HELPER: CREATE CONSTRAINT FIELD
// =============================================================================

/**
 * Create a constraint field with defaults.
 */
export function createConstraintField<T>(
  value: T | null,
  criticality: ConstraintCriticality,
  options?: {
    state?: FieldKnowledgeState;
    source?: string;
    authority_scope?: AuthorityScope;
    verified_at?: string;
    revalidation_required?: boolean;
  }
): ConstraintField<T> {
  return {
    value,
    state: options?.state ?? (value !== null ? 'known' : 'unknown'),
    criticality,
    source: options?.source ?? null,
    authority_scope: options?.authority_scope ?? 'unknown',
    verified_at: options?.verified_at ?? null,
    revalidation_required: options?.revalidation_required ?? false,
  };
}

/**
 * Create an unknown constraint field.
 */
export function createUnknownField<T>(
  criticality: ConstraintCriticality,
  authority_scope: AuthorityScope = 'unknown'
): ConstraintField<T> {
  return {
    value: null,
    state: 'unknown',
    criticality,
    source: null,
    authority_scope,
    verified_at: null,
    revalidation_required: false,
  };
}
