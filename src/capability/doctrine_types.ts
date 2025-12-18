/**
 * CCA DOCTRINE-LOCKED TYPES
 * ADR-022 Compliant — NO DEVIATIONS ALLOWED
 *
 * This file defines the LOCKED 4-stage pipeline types.
 * DO NOT modify without doctrine review.
 */

// =============================================================================
// DOCTRINE-LOCKED ENUMS
// =============================================================================

/**
 * Automation class (Stage 1 output)
 * LOCKED: api | portal | pdf | manual
 */
export type AutomationClass = 'api' | 'portal' | 'pdf' | 'manual';

/**
 * Zoning model (Stage 1 output)
 * LOCKED: no_zoning | county | municipal | mixed | unknown
 */
export type ZoningModelV2 = 'no_zoning' | 'county' | 'municipal' | 'mixed' | 'unknown';

/**
 * Confidence ceiling (DOCTRINE: may only stay same, go down, or go to unknown)
 * LOCKED: low | medium | high
 */
export type ConfidenceCeiling = 'low' | 'medium' | 'high';

/**
 * Pipeline stages (LOCKED)
 */
export type PipelineStage = 'probe' | 'viability_scan' | 'constraint_hydration' | 'human_escalation';

/**
 * Audit source
 */
export type AuditSource = 'automated' | 'manual';

// =============================================================================
// STAGE 1: CAPABILITY PROBE OUTPUT
// =============================================================================

/**
 * Stage 1 output — Capability Probe result
 * This is the ONLY stage that writes to CCA
 */
export interface CapabilityProbeOutput {
  // Required output fields (per doctrine)
  automation_class: AutomationClass;
  zoning_model: ZoningModelV2;
  permit_system_type: string;
  confidence_ceiling: ConfidenceCeiling;
  ttl_months: number;
  source_urls: string[];
  last_verified_at: string; // ISO timestamp

  // Optional metadata
  detected_vendor: string | null;
  planning_url: string | null;
  permits_url: string | null;
  error_message: string | null;
}

/**
 * Probe input
 */
export interface CapabilityProbeInput {
  county_id: number;
  county_fips: string;
  county_name: string;
  state_code: string;
}

// =============================================================================
// STAGE 2: THIN VIABILITY SCAN OUTPUT
// =============================================================================

/**
 * Stage 2 output — Thin Viability Scan result
 * READ-ONLY: Consumes CCA, does not write
 */
export interface ThinViabilityScanOutput {
  // Required output fields (per doctrine)
  allowed_somewhere: 'yes' | 'no' | 'unknown';
  fatal_prohibition: 'yes' | 'no' | 'unknown';
  authority: 'county' | 'municipal' | 'mixed' | 'unknown';

  // Confidence ceiling from CCA
  confidence_ceiling: ConfidenceCeiling;
  scan_source: AuditSource;
}

// =============================================================================
// STAGE 3: TARGETED CONSTRAINT HYDRATION
// =============================================================================

/**
 * Constraint field with citation (DOCTRINE: Every numeric value MUST have a citation)
 */
export interface CitedConstraint<T> {
  value: T | null;
  citation: string | null;
  confidence: ConfidenceCeiling;
}

/**
 * Stage 3 output — Targeted Constraint Hydration result
 * READ-ONLY: Only triggered when geometry_blocked = true
 */
export interface ConstraintHydrationOutput {
  // Allowed fields (per doctrine)
  setbacks: CitedConstraint<{
    front_ft: number | null;
    side_ft: number | null;
    rear_ft: number | null;
  }>;
  lot_coverage: CitedConstraint<number>; // Percentage
  buffers: CitedConstraint<{
    landscape_ft: number | null;
    screening_ft: number | null;
  }>;
  fire_access: CitedConstraint<{
    width_ft: number | null;
    turnaround_required: boolean | null;
  }>;
  stormwater_constraints: CitedConstraint<{
    detention_required: boolean | null;
    impervious_limit_pct: number | null;
  }>;

  // Metadata
  geometry_blocked: boolean;
  fields_missing: string[];
  confidence_ceiling: ConfidenceCeiling;
}

// =============================================================================
// STAGE 4: HUMAN ESCALATION
// =============================================================================

/**
 * Human escalation request
 * Triggered when geometry_blocked = true AND required field remains unknown
 */
export interface HumanEscalationRequest {
  county_id: number;
  county_fips: string;
  reason: string;
  required_fields: string[];
  current_confidence: ConfidenceCeiling;
  requested_at: string; // ISO timestamp
}

/**
 * Human verification result
 * Output tagged as manual_verified
 */
export interface HumanVerificationResult {
  county_id: number;
  county_fips: string;
  verified_by: string;
  verified_at: string; // ISO timestamp
  fields_verified: Record<string, unknown>;
  confidence_ceiling: 'high'; // Manual verification allows high confidence
}

// =============================================================================
// AUDIT LOG ENTRY
// =============================================================================

/**
 * Audit log entry (REQUIRED for every action)
 */
export interface CcaAuditLogEntry {
  county_fips: string;
  stage: PipelineStage;
  action: string;
  result: string;
  confidence_ceiling: ConfidenceCeiling;
  timestamp: string; // ISO timestamp
  source: AuditSource;
  details?: Record<string, unknown>;
  error_message?: string;
}

// =============================================================================
// KILL SWITCH TYPES
// =============================================================================

/**
 * Kill switch check result
 */
export interface KillSwitchResult {
  should_kill: boolean;
  kill_reason: string | null;
  stage: PipelineStage | null;
}

// =============================================================================
// PASS CONSUMPTION CONTRACTS
// =============================================================================

/**
 * Pass 0 throttle result (READ-ONLY)
 */
export interface Pass0ThrottleResult {
  allow_full_automation: boolean;
  confidence_cap: ConfidenceCeiling;
  throttle_reason: string | null;
}

/**
 * Pass 2 routing result (READ-ONLY)
 */
export interface Pass2RoutingResult {
  route_to: 'firecrawl' | 'retell' | 'manual_queue' | 'do_nothing';
  confidence_ceiling: ConfidenceCeiling;
  routing_reason: string | null;
}

// =============================================================================
// CONFIDENCE CEILING ENFORCEMENT
// =============================================================================

/**
 * DOCTRINE: Confidence may ONLY stay same, go down, or go to unknown
 * NEVER upgraded without citation
 */
export function applyConfidenceCeiling(
  currentConfidence: ConfidenceCeiling,
  ccaCeiling: ConfidenceCeiling
): ConfidenceCeiling {
  const ranks: Record<ConfidenceCeiling, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  // Return the lower of the two (never upgrade)
  if (ranks[currentConfidence] <= ranks[ccaCeiling]) {
    return currentConfidence;
  }
  return ccaCeiling;
}

/**
 * Check if confidence upgrade is attempted (DOCTRINE VIOLATION)
 */
export function isConfidenceUpgradeAttempt(
  before: ConfidenceCeiling,
  after: ConfidenceCeiling
): boolean {
  const ranks: Record<ConfidenceCeiling, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };
  return ranks[after] > ranks[before];
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate probe output has no violations
 */
export function validateProbeOutput(output: CapabilityProbeOutput): string[] {
  const violations: string[] = [];

  // DOCTRINE: source_urls required
  if (!output.source_urls || output.source_urls.length === 0) {
    // Not a violation if unknown — unknown is valid
    if (output.automation_class !== 'manual') {
      violations.push('source_urls required for non-manual automation_class');
    }
  }

  // DOCTRINE: ttl_months must be positive
  if (output.ttl_months <= 0) {
    violations.push('ttl_months must be positive');
  }

  return violations;
}

/**
 * Validate citation exists for numeric constraint
 */
export function validateCitedConstraint<T>(
  field_name: string,
  constraint: CitedConstraint<T>
): string[] {
  const violations: string[] = [];

  // DOCTRINE: No citation → unknown
  if (constraint.value !== null && !constraint.citation) {
    violations.push(`${field_name}: numeric value without citation — must be unknown`);
  }

  return violations;
}

// =============================================================================
// TTL CONSTANTS (LOCKED)
// =============================================================================

export const TTL_MONTHS = 12;
export const TTL_MS = TTL_MONTHS * 30 * 24 * 60 * 60 * 1000;

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_PROBE_OUTPUT: CapabilityProbeOutput = {
  automation_class: 'manual',
  zoning_model: 'unknown',
  permit_system_type: 'unknown',
  confidence_ceiling: 'low',
  ttl_months: TTL_MONTHS,
  source_urls: [],
  last_verified_at: new Date().toISOString(),
  detected_vendor: null,
  planning_url: null,
  permits_url: null,
  error_message: null,
};

export const DEFAULT_VIABILITY_SCAN: ThinViabilityScanOutput = {
  allowed_somewhere: 'unknown',
  fatal_prohibition: 'unknown',
  authority: 'unknown',
  confidence_ceiling: 'low',
  scan_source: 'automated',
};
