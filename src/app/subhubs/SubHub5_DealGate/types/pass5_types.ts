/**
 * PASS-5 TYPE DEFINITIONS
 *
 * Type definitions for SubHub5_DealGate (SS.05.00)
 * Doctrine enforcement and final Go/No-Go verdict.
 *
 * Anchor: SVA + Parcel ID
 * Constraint: BINARY_OUTPUT (GOOD_DEAL | BAD_DEAL only)
 *
 * All types are JSON-serializable for edge/cloud function execution.
 */

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// VERDICT TYPES (BINARY OUTPUT CONSTRAINT)
// ============================================================================

/**
 * Final deal verdict - MUST be binary
 */
export type DealVerdict = 'GOOD_DEAL' | 'BAD_DEAL';

/**
 * Gate evaluation result
 */
export type GateResult = 'PASSED' | 'FAILED' | 'SKIPPED';

// ============================================================================
// GATE DEFINITIONS
// ============================================================================

/**
 * Market Gate - evaluates market conditions
 */
export interface MarketGateResult {
  gate: 'MARKET';
  result: GateResult;
  score: number;
  threshold: number;
  metrics: {
    demandScore?: number;
    supplyScore?: number;
    competitionScore?: number;
    hotspotTier?: string;
  };
  reason: string;
}

/**
 * Rules Gate - evaluates jurisdiction constraints
 */
export interface RulesGateResult {
  gate: 'RULES';
  result: GateResult;
  constraintsPassed: number;
  constraintsFailed: number;
  failedConstraints: string[];
  reason: string;
}

/**
 * Feasibility Gate - evaluates financial viability
 */
export interface FeasibilityGateResult {
  gate: 'FEASIBILITY';
  result: GateResult;
  metrics: {
    projectedIRR?: number;
    hurdleIRR?: number;
    projectedNOI?: number;
    maxLandPrice?: number;
  };
  reason: string;
}

/**
 * Parcel Gate - evaluates parcel validity
 */
export interface ParcelGateResult {
  gate: 'PARCEL';
  result: GateResult;
  parcelId: string;
  dataQuality: number;
  promotionValid: boolean;
  reason: string;
}

/**
 * All gates combined
 */
export type GateEvaluation =
  | MarketGateResult
  | RulesGateResult
  | FeasibilityGateResult
  | ParcelGateResult;

// ============================================================================
// GATE EVALUATOR RESULT (SS.05.01)
// ============================================================================

export interface GateEvaluatorResult {
  status: SpokeStatus;
  gates: {
    market?: MarketGateResult;
    rules?: RulesGateResult;
    feasibility?: FeasibilityGateResult;
    parcel?: ParcelGateResult;
  };
  totalGates: number;
  passedGates: number;
  failedGates: number;
  skippedGates: number;
  notes: string;
}

// ============================================================================
// DOCTRINE ENFORCER RESULT (SS.05.02)
// ============================================================================

export interface DoctrineViolation {
  code: string;
  severity: 'HARD' | 'SOFT';
  description: string;
  remediation?: string;
}

export interface DoctrineEnforcerResult {
  status: SpokeStatus;
  compliant: boolean;
  violations: DoctrineViolation[];
  hardViolations: number;
  softViolations: number;
  notes: string;
}

// ============================================================================
// VERDICT COMPILER RESULT (SS.05.03)
// ============================================================================

export interface VerdictCompilerResult {
  status: SpokeStatus;
  verdict: DealVerdict;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  gatesSummary: {
    passed: string[];
    failed: string[];
    skipped: string[];
  };
  doctrineCompliant: boolean;
  reasons: string[];
  timestamp: string;
}

// ============================================================================
// DEAL VERDICT OUTPUT (Final Output Contract)
// ============================================================================

export interface DealVerdictOutput {
  /** Sovereign ID anchor */
  sva: string;
  /** Parcel ID anchor */
  parcelId: string;
  /** Binary verdict (CONSTRAINT: BINARY_OUTPUT) */
  verdict: DealVerdict;
  /** Gates that passed */
  gatesPassed: string[];
  /** Gates that failed */
  gatesFailed: string[];
  /** Verdict timestamp */
  timestamp: string;
  /** Confidence level */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable summary */
  summary: string;
}

// ============================================================================
// PASS-5 INPUT
// ============================================================================

export interface Pass5Input {
  /** SVA reference (anchor) */
  svaId: string;
  /** Parcel ID (anchor) */
  parcelId: string;
  /** SubHub0 output reference */
  subhub0RunId?: string;
  /** SubHub1 output reference */
  subhub1RunId?: string;
  /** SubHub2 output reference */
  subhub2RunId?: string;
  /** SubHub3 output reference */
  subhub3RunId?: string;
  /** SubHub4 output reference */
  subhub4RunId?: string;
  /** Gate configuration overrides */
  gateConfig?: {
    marketThreshold?: number;
    irrHurdle?: number;
    minDataQuality?: number;
  };
  /** Skip specific gates (use with caution) */
  skipGates?: string[];
}

// ============================================================================
// PASS-5 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass5Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  /** Anchors */
  svaId: string;
  parcelId: string;
  /** Spoke results */
  gateEvaluator: GateEvaluatorResult;
  doctrineEnforcer: DoctrineEnforcerResult;
  verdictCompiler: VerdictCompilerResult;
  /** Final verdict output */
  finalVerdict: DealVerdictOutput;
  error?: string;
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubGateEvaluator(): GateEvaluatorResult {
  return {
    status: 'stub',
    gates: {},
    totalGates: 0,
    passedGates: 0,
    failedGates: 0,
    skippedGates: 0,
    notes: 'Gate evaluator not implemented. TODO: Evaluate all gates.',
  };
}

export function createStubDoctrineEnforcer(): DoctrineEnforcerResult {
  return {
    status: 'stub',
    compliant: false,
    violations: [],
    hardViolations: 0,
    softViolations: 0,
    notes: 'Doctrine enforcer not implemented. TODO: Check doctrine compliance.',
  };
}

export function createStubVerdictCompiler(): VerdictCompilerResult {
  return {
    status: 'stub',
    verdict: 'BAD_DEAL',
    confidence: 'LOW',
    gatesSummary: { passed: [], failed: [], skipped: [] },
    doctrineCompliant: false,
    reasons: ['Verdict compiler not implemented'],
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResult<T extends { status: SpokeStatus; notes: string }>(
  error: Error | string,
  factory: () => T
): T {
  const result = factory();
  result.status = 'error';
  result.notes = `Error: ${error instanceof Error ? error.message : error}`;
  return result;
}
