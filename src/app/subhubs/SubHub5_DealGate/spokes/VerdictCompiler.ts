/**
 * VerdictCompiler Spoke (SS.05.03)
 *
 * Compiles final GOOD_DEAL or BAD_DEAL verdict.
 * CONSTRAINT: BINARY_OUTPUT - Only GOOD_DEAL or BAD_DEAL allowed.
 *
 * @module SubHub5_DealGate/spokes/VerdictCompiler
 */

import {
  VerdictCompilerResult,
  DealVerdict,
  GateEvaluatorResult,
  DoctrineEnforcerResult,
  createStubVerdictCompiler,
  createErrorResult,
} from '../types/pass5_types';

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface VerdictCompilerInput {
  /** SVA reference */
  svaId: string;
  /** Parcel ID */
  parcelId: string;
  /** Gate evaluation results */
  gateResults: GateEvaluatorResult;
  /** Doctrine compliance results */
  doctrineResults: DoctrineEnforcerResult;
  /** Strict mode - all gates must pass */
  strictMode?: boolean;
  /** Minimum gates to pass (if not strict) */
  minGatesToPass?: number;
}

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Compile final verdict
 *
 * CONSTRAINT: BINARY_OUTPUT - Must return GOOD_DEAL or BAD_DEAL only
 */
export async function runVerdictCompiler(
  input: VerdictCompilerInput
): Promise<VerdictCompilerResult> {
  try {
    console.log(`[VERDICT_COMPILER] Compiling verdict for SVA ${input.svaId}...`);

    const strictMode = input.strictMode ?? true;
    const minGates = input.minGatesToPass ?? 4;

    // Collect gate results
    const gatesSummary = {
      passed: [] as string[],
      failed: [] as string[],
      skipped: [] as string[],
    };

    const gates = input.gateResults.gates;
    for (const [name, result] of Object.entries(gates)) {
      if (result) {
        if (result.result === 'PASSED') {
          gatesSummary.passed.push(name.toUpperCase());
        } else if (result.result === 'FAILED') {
          gatesSummary.failed.push(name.toUpperCase());
        } else {
          gatesSummary.skipped.push(name.toUpperCase());
        }
      }
    }

    // Determine verdict
    const { verdict, confidence, reasons } = determineVerdict(
      gatesSummary,
      input.doctrineResults,
      strictMode,
      minGates
    );

    return {
      status: 'ok',
      verdict,
      confidence,
      gatesSummary,
      doctrineCompliant: input.doctrineResults.compliant,
      reasons,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[VERDICT_COMPILER] Error:', error);
    return createErrorResult(error as Error, createStubVerdictCompiler);
  }
}

// ============================================================================
// VERDICT DETERMINATION
// ============================================================================

function determineVerdict(
  gatesSummary: { passed: string[]; failed: string[]; skipped: string[] },
  doctrineResults: DoctrineEnforcerResult,
  strictMode: boolean,
  minGates: number
): { verdict: DealVerdict; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[] } {
  const reasons: string[] = [];

  // HARD RULE 1: Doctrine compliance (hard violations = BAD_DEAL)
  if (!doctrineResults.compliant) {
    reasons.push(`Doctrine non-compliant: ${doctrineResults.hardViolations} hard violations`);
    return {
      verdict: 'BAD_DEAL',
      confidence: 'HIGH',
      reasons,
    };
  }

  // HARD RULE 2: In strict mode, any failed gate = BAD_DEAL
  if (strictMode && gatesSummary.failed.length > 0) {
    reasons.push(`Strict mode: ${gatesSummary.failed.length} gates failed`);
    reasons.push(`Failed gates: ${gatesSummary.failed.join(', ')}`);
    return {
      verdict: 'BAD_DEAL',
      confidence: 'HIGH',
      reasons,
    };
  }

  // RULE 3: Must pass minimum number of gates
  if (gatesSummary.passed.length < minGates) {
    reasons.push(`Insufficient gates passed: ${gatesSummary.passed.length}/${minGates} required`);
    return {
      verdict: 'BAD_DEAL',
      confidence: 'MEDIUM',
      reasons,
    };
  }

  // RULE 4: All gates passed = GOOD_DEAL with HIGH confidence
  if (gatesSummary.failed.length === 0 && gatesSummary.skipped.length === 0) {
    reasons.push(`All ${gatesSummary.passed.length} gates passed`);
    reasons.push('Doctrine compliant');
    return {
      verdict: 'GOOD_DEAL',
      confidence: 'HIGH',
      reasons,
    };
  }

  // RULE 5: Some gates skipped but none failed = GOOD_DEAL with MEDIUM confidence
  if (gatesSummary.failed.length === 0 && gatesSummary.skipped.length > 0) {
    reasons.push(`${gatesSummary.passed.length} gates passed, ${gatesSummary.skipped.length} skipped`);
    reasons.push('Doctrine compliant');
    return {
      verdict: 'GOOD_DEAL',
      confidence: 'MEDIUM',
      reasons,
    };
  }

  // RULE 6: Some gates failed but met minimum = GOOD_DEAL with LOW confidence
  if (gatesSummary.passed.length >= minGates) {
    reasons.push(`${gatesSummary.passed.length} gates passed (min ${minGates})`);
    reasons.push(`${gatesSummary.failed.length} gates failed: ${gatesSummary.failed.join(', ')}`);
    return {
      verdict: 'GOOD_DEAL',
      confidence: 'LOW',
      reasons,
    };
  }

  // DEFAULT: BAD_DEAL
  reasons.push('Default verdict: insufficient evidence for GOOD_DEAL');
  return {
    verdict: 'BAD_DEAL',
    confidence: 'MEDIUM',
    reasons,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runVerdictCompiler;
