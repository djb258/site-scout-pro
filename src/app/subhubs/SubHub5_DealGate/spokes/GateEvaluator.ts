/**
 * GateEvaluator Spoke (SS.05.01)
 *
 * Evaluates all decision gates: Market, Rules, Feasibility, Parcel.
 * Each gate must pass for a GOOD_DEAL verdict.
 *
 * @module SubHub5_DealGate/spokes/GateEvaluator
 */

import {
  GateEvaluatorResult,
  MarketGateResult,
  RulesGateResult,
  FeasibilityGateResult,
  ParcelGateResult,
  GateResult,
  createStubGateEvaluator,
  createErrorResult,
} from '../types/pass5_types';

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface GateEvaluatorInput {
  /** SVA reference */
  svaId: string;
  /** Parcel ID */
  parcelId: string;
  /** Market data from SubHub1 */
  marketData?: {
    hotspotScore?: number;
    tier?: string;
    demandScore?: number;
    supplyScore?: number;
    competitorCount?: number;
  };
  /** Rules data from SubHub2 */
  rulesData?: {
    constraintsPassed?: string[];
    constraintsFailed?: string[];
    zoningCompatible?: boolean;
  };
  /** Feasibility data from SubHub3 */
  feasibilityData?: {
    projectedIRR?: number;
    projectedNOI?: number;
    maxLandPrice?: number;
  };
  /** Parcel data from SubHub4 */
  parcelData?: {
    dataQualityScore?: number;
    promotionValid?: boolean;
  };
  /** Gate thresholds */
  thresholds?: {
    marketScore?: number;
    irrHurdle?: number;
    minDataQuality?: number;
  };
  /** Gates to skip */
  skipGates?: string[];
}

// ============================================================================
// DEFAULT THRESHOLDS
// ============================================================================

const DEFAULT_THRESHOLDS = {
  marketScore: 50,
  irrHurdle: 0.15, // 15% IRR
  minDataQuality: 60,
};

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Evaluate all decision gates
 */
export async function runGateEvaluator(input: GateEvaluatorInput): Promise<GateEvaluatorResult> {
  try {
    console.log(`[GATE_EVALUATOR] Evaluating gates for SVA ${input.svaId}, Parcel ${input.parcelId}...`);

    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...input.thresholds,
    };

    const skipGates = new Set(input.skipGates ?? []);

    // Evaluate each gate
    const market = skipGates.has('MARKET')
      ? createSkippedMarketGate()
      : evaluateMarketGate(input.marketData, thresholds.marketScore);

    const rules = skipGates.has('RULES')
      ? createSkippedRulesGate()
      : evaluateRulesGate(input.rulesData);

    const feasibility = skipGates.has('FEASIBILITY')
      ? createSkippedFeasibilityGate()
      : evaluateFeasibilityGate(input.feasibilityData, thresholds.irrHurdle);

    const parcel = skipGates.has('PARCEL')
      ? createSkippedParcelGate(input.parcelId)
      : evaluateParcelGate(input.parcelId, input.parcelData, thresholds.minDataQuality);

    // Count results
    const gates = { market, rules, feasibility, parcel };
    const results = Object.values(gates);

    const passedGates = results.filter((g) => g.result === 'PASSED').length;
    const failedGates = results.filter((g) => g.result === 'FAILED').length;
    const skippedGates = results.filter((g) => g.result === 'SKIPPED').length;

    return {
      status: 'ok',
      gates,
      totalGates: 4,
      passedGates,
      failedGates,
      skippedGates,
      notes: `Evaluated 4 gates: ${passedGates} passed, ${failedGates} failed, ${skippedGates} skipped.`,
    };
  } catch (error) {
    console.error('[GATE_EVALUATOR] Error:', error);
    return createErrorResult(error as Error, createStubGateEvaluator);
  }
}

// ============================================================================
// GATE EVALUATIONS
// ============================================================================

function evaluateMarketGate(
  data: GateEvaluatorInput['marketData'],
  threshold: number
): MarketGateResult {
  if (!data) {
    return {
      gate: 'MARKET',
      result: 'FAILED',
      score: 0,
      threshold,
      metrics: {},
      reason: 'No market data available',
    };
  }

  const score = data.hotspotScore ?? 0;
  const result: GateResult = score >= threshold ? 'PASSED' : 'FAILED';

  return {
    gate: 'MARKET',
    result,
    score,
    threshold,
    metrics: {
      demandScore: data.demandScore,
      supplyScore: data.supplyScore,
      competitionScore: data.competitorCount ? Math.max(0, 100 - data.competitorCount * 5) : undefined,
      hotspotTier: data.tier,
    },
    reason:
      result === 'PASSED'
        ? `Market score ${score} meets threshold ${threshold}`
        : `Market score ${score} below threshold ${threshold}`,
  };
}

function evaluateRulesGate(data: GateEvaluatorInput['rulesData']): RulesGateResult {
  if (!data) {
    return {
      gate: 'RULES',
      result: 'FAILED',
      constraintsPassed: 0,
      constraintsFailed: 0,
      failedConstraints: ['No rules data available'],
      reason: 'No jurisdiction rules data available',
    };
  }

  const passed = data.constraintsPassed?.length ?? 0;
  const failed = data.constraintsFailed?.length ?? 0;

  // Must have no failed constraints and zoning must be compatible
  const result: GateResult =
    failed === 0 && data.zoningCompatible !== false ? 'PASSED' : 'FAILED';

  return {
    gate: 'RULES',
    result,
    constraintsPassed: passed,
    constraintsFailed: failed,
    failedConstraints: data.constraintsFailed ?? [],
    reason:
      result === 'PASSED'
        ? `All ${passed} constraints satisfied`
        : `${failed} constraints failed: ${data.constraintsFailed?.join(', ')}`,
  };
}

function evaluateFeasibilityGate(
  data: GateEvaluatorInput['feasibilityData'],
  hurdleIRR: number
): FeasibilityGateResult {
  if (!data) {
    return {
      gate: 'FEASIBILITY',
      result: 'FAILED',
      metrics: {},
      reason: 'No feasibility data available',
    };
  }

  const irr = data.projectedIRR ?? 0;
  const result: GateResult = irr >= hurdleIRR ? 'PASSED' : 'FAILED';

  return {
    gate: 'FEASIBILITY',
    result,
    metrics: {
      projectedIRR: irr,
      hurdleIRR: hurdleIRR,
      projectedNOI: data.projectedNOI,
      maxLandPrice: data.maxLandPrice,
    },
    reason:
      result === 'PASSED'
        ? `Projected IRR ${(irr * 100).toFixed(1)}% meets hurdle ${(hurdleIRR * 100).toFixed(1)}%`
        : `Projected IRR ${(irr * 100).toFixed(1)}% below hurdle ${(hurdleIRR * 100).toFixed(1)}%`,
  };
}

function evaluateParcelGate(
  parcelId: string,
  data: GateEvaluatorInput['parcelData'],
  minQuality: number
): ParcelGateResult {
  if (!data) {
    return {
      gate: 'PARCEL',
      result: 'FAILED',
      parcelId,
      dataQuality: 0,
      promotionValid: false,
      reason: 'No parcel data available',
    };
  }

  const quality = data.dataQualityScore ?? 0;
  const promotionValid = data.promotionValid ?? false;

  const result: GateResult =
    quality >= minQuality && promotionValid ? 'PASSED' : 'FAILED';

  return {
    gate: 'PARCEL',
    result,
    parcelId,
    dataQuality: quality,
    promotionValid,
    reason:
      result === 'PASSED'
        ? `Parcel ${parcelId} meets quality threshold (${quality}%) and promotion is valid`
        : `Parcel ${parcelId} failed: quality=${quality}%, promoted=${promotionValid}`,
  };
}

// ============================================================================
// SKIPPED GATE FACTORIES
// ============================================================================

function createSkippedMarketGate(): MarketGateResult {
  return {
    gate: 'MARKET',
    result: 'SKIPPED',
    score: 0,
    threshold: 0,
    metrics: {},
    reason: 'Market gate skipped by configuration',
  };
}

function createSkippedRulesGate(): RulesGateResult {
  return {
    gate: 'RULES',
    result: 'SKIPPED',
    constraintsPassed: 0,
    constraintsFailed: 0,
    failedConstraints: [],
    reason: 'Rules gate skipped by configuration',
  };
}

function createSkippedFeasibilityGate(): FeasibilityGateResult {
  return {
    gate: 'FEASIBILITY',
    result: 'SKIPPED',
    metrics: {},
    reason: 'Feasibility gate skipped by configuration',
  };
}

function createSkippedParcelGate(parcelId: string): ParcelGateResult {
  return {
    gate: 'PARCEL',
    result: 'SKIPPED',
    parcelId,
    dataQuality: 0,
    promotionValid: false,
    reason: 'Parcel gate skipped by configuration',
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runGateEvaluator;
