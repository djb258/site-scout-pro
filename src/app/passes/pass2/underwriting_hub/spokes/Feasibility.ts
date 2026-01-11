// =============================================================================
// FEASIBILITY CONSTRAINT GATE — Pass-2 Eligibility Check ONLY
// =============================================================================
// Doctrine ID: SS.02.07
// Purpose: Validate constraint eligibility for Pass-3 financial modeling
//
// DOCTRINAL NOTE: Pass 2 is the CONSTRAINT & ELIGIBILITY HUB.
// NO financial calculations belong here. All financial modeling
// (NOI, DSCR, Yield, etc.) is performed in Pass 3 (SS.03.07).
//
// This spoke only validates:
// - Required inputs are present
// - Constraint data is available
// - Site meets minimum eligibility requirements for financial analysis
//
// See: src/pass3/design_hub/spokes/Feasibility.ts for full financial modeling
// =============================================================================

import type {
  FeasibilityInput,
  CivilConstraintResult,
  ZoningResult,
  PricingVerificationResult,
} from '../types/pass2_types';

// =============================================================================
// CONSTRAINT GATE TYPES
// =============================================================================

export type ConstraintFatalFlawCode =
  | 'MISSING_ACREAGE'
  | 'ZERO_ACREAGE'
  | 'MISSING_ZONING'
  | 'ZONING_PROHIBITED'
  | 'MISSING_CIVIL_CONSTRAINTS'
  | 'CIVIL_PROHIBITIVE'
  | 'MISSING_RENT_DATA'
  | 'INSUFFICIENT_DATA';

export type ConstraintWarningCode =
  | 'ZONING_CONDITIONAL'
  | 'CIVIL_CHALLENGING'
  | 'RENT_DATA_LOW_CONFIDENCE'
  | 'PARTIAL_DATA';

export interface ConstraintFatalFlaw {
  code: ConstraintFatalFlawCode;
  severity: 'critical';
  message: string;
  field?: string;
}

export interface ConstraintWarning {
  code: ConstraintWarningCode;
  severity: 'warning';
  message: string;
  field?: string;
}

export interface ConstraintUnknown {
  field: string;
  reason: string;
  required_for_pass3: boolean;
}

// =============================================================================
// OUTPUT INTERFACE — Constraint Gate Result
// =============================================================================

export interface FeasibilityConstraintOutput {
  // Spoke metadata
  spokeId: 'SS.02.07';
  status: 'ok' | 'error';
  timestamp: string;

  // Constraint validation result
  constraints_satisfied: boolean;

  // Fatal flaws that block Pass 3
  fatal_flaws: ConstraintFatalFlaw[];

  // Warnings that should be noted but don't block
  warnings: ConstraintWarning[];

  // Unknown/missing data fields
  unknowns: ConstraintUnknown[];

  // Eligibility summary
  eligible_for_pass3: boolean;
  pass3_ready: boolean;

  // Human-readable notes
  notes: string;
}

// =============================================================================
// CONSTRAINT VALIDATION INPUT
// =============================================================================

export interface ConstraintGateInput {
  acreage?: number;
  zoning?: ZoningResult;
  civilConstraints?: CivilConstraintResult;
  rentBenchmarks?: PricingVerificationResult;
  opportunity?: unknown;
}

// =============================================================================
// MAIN CONSTRAINT GATE FUNCTION
// =============================================================================

/**
 * Constraint Gate for Pass-2
 * Validates that all required constraint data is present and site is eligible
 * for Pass-3 financial modeling. NO calculations performed here.
 */
export async function runFeasibility(input: ConstraintGateInput): Promise<FeasibilityConstraintOutput> {
  const timestamp = new Date().toISOString();
  const fatalFlaws: ConstraintFatalFlaw[] = [];
  const warnings: ConstraintWarning[] = [];
  const unknowns: ConstraintUnknown[] = [];

  // ---------------------------------------------------------------------------
  // STEP 1: Validate Acreage
  // ---------------------------------------------------------------------------

  if (input.acreage === undefined || input.acreage === null) {
    fatalFlaws.push({
      code: 'MISSING_ACREAGE',
      severity: 'critical',
      message: 'Acreage is required for feasibility analysis',
      field: 'acreage',
    });
  } else if (input.acreage <= 0) {
    fatalFlaws.push({
      code: 'ZERO_ACREAGE',
      severity: 'critical',
      message: 'Acreage must be greater than zero',
      field: 'acreage',
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Validate Zoning Constraints
  // ---------------------------------------------------------------------------

  if (!input.zoning || input.zoning.status === 'stub') {
    unknowns.push({
      field: 'zoning',
      reason: 'Zoning data not available',
      required_for_pass3: true,
    });
  } else if (input.zoning.status === 'error') {
    fatalFlaws.push({
      code: 'MISSING_ZONING',
      severity: 'critical',
      message: 'Zoning analysis failed - cannot determine eligibility',
      field: 'zoning',
    });
  } else if (input.zoning.storageAllowed === false) {
    fatalFlaws.push({
      code: 'ZONING_PROHIBITED',
      severity: 'critical',
      message: 'Storage use is prohibited by zoning',
      field: 'zoning.storageAllowed',
    });
  } else if (input.zoning.classification === 'prohibited') {
    fatalFlaws.push({
      code: 'ZONING_PROHIBITED',
      severity: 'critical',
      message: 'Zoning classification is prohibitive',
      field: 'zoning.classification',
    });
  } else if (input.zoning.conditionalUseRequired || input.zoning.classification === 'conditional') {
    warnings.push({
      code: 'ZONING_CONDITIONAL',
      severity: 'warning',
      message: 'Conditional use permit may be required',
      field: 'zoning',
    });
  } else if (input.zoning.classification === 'challenging') {
    warnings.push({
      code: 'ZONING_CONDITIONAL',
      severity: 'warning',
      message: 'Zoning is challenging but not prohibitive',
      field: 'zoning.classification',
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Validate Civil Constraints
  // ---------------------------------------------------------------------------

  if (!input.civilConstraints || input.civilConstraints.status === 'stub') {
    unknowns.push({
      field: 'civilConstraints',
      reason: 'Civil constraint data not available',
      required_for_pass3: true,
    });
  } else if (input.civilConstraints.status === 'error') {
    fatalFlaws.push({
      code: 'MISSING_CIVIL_CONSTRAINTS',
      severity: 'critical',
      message: 'Civil constraints analysis failed',
      field: 'civilConstraints',
    });
  } else if (input.civilConstraints.civilRating === 'prohibitive') {
    fatalFlaws.push({
      code: 'CIVIL_PROHIBITIVE',
      severity: 'critical',
      message: 'Civil constraints are prohibitive for development',
      field: 'civilConstraints.civilRating',
    });
  } else if (input.civilConstraints.civilRating === 'challenging') {
    warnings.push({
      code: 'CIVIL_CHALLENGING',
      severity: 'warning',
      message: 'Civil constraints are challenging - cost impacts expected',
      field: 'civilConstraints.civilRating',
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Validate Rent Benchmarks
  // ---------------------------------------------------------------------------

  if (!input.rentBenchmarks || input.rentBenchmarks.status === 'stub') {
    unknowns.push({
      field: 'rentBenchmarks',
      reason: 'Rent benchmark data not available',
      required_for_pass3: true,
    });
  } else if (input.rentBenchmarks.status === 'error') {
    warnings.push({
      code: 'RENT_DATA_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'Rent benchmark data has errors - Pass 3 will use defaults',
      field: 'rentBenchmarks',
    });
  } else if (input.rentBenchmarks.confidence === 'low') {
    warnings.push({
      code: 'RENT_DATA_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'Rent benchmark confidence is low',
      field: 'rentBenchmarks.confidence',
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Determine Eligibility
  // ---------------------------------------------------------------------------

  const hasNoFatalFlaws = fatalFlaws.length === 0;
  const hasAllRequiredData = unknowns.filter(u => u.required_for_pass3).length === 0;

  const constraints_satisfied = hasNoFatalFlaws;
  const eligible_for_pass3 = hasNoFatalFlaws;
  const pass3_ready = hasNoFatalFlaws && hasAllRequiredData;

  // ---------------------------------------------------------------------------
  // STEP 6: Build Notes Summary
  // ---------------------------------------------------------------------------

  const notesParts: string[] = [];
  notesParts.push('Pass-2 Constraint Gate');

  if (fatalFlaws.length > 0) {
    notesParts.push(`BLOCKED: ${fatalFlaws.length} fatal constraint(s)`);
  } else if (unknowns.length > 0) {
    notesParts.push(`ELIGIBLE with ${unknowns.length} unknown(s) - Pass 3 will use defaults`);
  } else {
    notesParts.push('ELIGIBLE: All constraints satisfied');
  }

  if (warnings.length > 0) {
    notesParts.push(`${warnings.length} warning(s) noted`);
  }

  // ---------------------------------------------------------------------------
  // STEP 7: Return Constraint Gate Result
  // ---------------------------------------------------------------------------

  return {
    spokeId: 'SS.02.07',
    status: fatalFlaws.length > 0 ? 'error' : 'ok',
    timestamp,
    constraints_satisfied,
    fatal_flaws: fatalFlaws,
    warnings,
    unknowns,
    eligible_for_pass3,
    pass3_ready,
    notes: notesParts.join('. '),
  };
}

// =============================================================================
// RE-EXPORT Pass-3 Feasibility for backward compatibility
// =============================================================================
// IMPORTANT: Financial calculations live in Pass 3. Import from there.
export {
  runFeasibility as runPass3Feasibility,
  DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY,
  DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY,
  DOCTRINE_MIN_DSCR,
  DEFAULT_VACANCY_RATE,
  DEFAULT_COLLECTION_LOSS_RATE,
  DEFAULT_OPEX_RATIO,
  DEFAULT_INTEREST_RATE,
  DEFAULT_AMORTIZATION_YEARS,
  DEFAULT_LTV,
  STRESS_TEST_HAIRCUT,
  type FeasibilityOutput as Pass3FeasibilityOutput,
  type FeasibilityInput as Pass3FeasibilityInput,
  type FeasibilityFatalFlaw as Pass3FatalFlaw,
  type FeasibilityWarning as Pass3Warning,
} from '../../../pass3/design_hub/spokes/Feasibility';
