/**
 * VERDICT SPOKE
 *
 * Responsibility: Generate final BUY/BUILD/WALK verdict from all analyses
 *
 * Inputs:
 *   - feasibility: FeasibilityResult
 *   - fusion_demand: FusionDemandResult
 *   - zoning: ZoningResult
 *   - permits: PermitResult
 *   - competitive_pressure: CompetitivePressureResult
 *   - analysis_mode: 'build' | 'buy' | 'compare'
 *
 * Outputs:
 *   - VerdictResult with PROCEED/EVALUATE/WALK decision
 *
 * Scoring Weights:
 *   - Feasibility: 35%
 *   - Fusion Demand: 25%
 *   - Zoning: 20%
 *   - Permit Complexity: 20%
 */

import type {
  FinalVerdict,
  FeasibilityResult as LegacyFeasibilityResult,
  FusionDemandResult as LegacyFusionDemandResult,
  ZoningIntel,
  PermitIntel,
  CompetitivePressureAnalysis,
  AnalysisToggles,
  OpportunityObject,
} from '../../../shared/opportunity_object';
import type {
  VerdictResult,
  ZoningResult,
  PermitResult,
  PricingVerificationResult,
  FusionDemandResult,
  CompetitivePressureResult,
  CivilConstraintResult,
  FeasibilityResult,
  ReverseFeasibilityResult,
  MomentumResult,
} from '../../types/pass2_types';
import { createStubVerdict, createErrorResult } from '../../types/pass2_types';
import { getCivilRiskFactors } from '../civil_constraints';

export interface VerdictInput {
  feasibility: LegacyFeasibilityResult;
  fusion_demand: LegacyFusionDemandResult;
  zoning_intel: ZoningIntel;
  permit_intel: PermitIntel;
  competitive_pressure: CompetitivePressureAnalysis;
  toggles: AnalysisToggles;
}

// Scoring weights
const FEASIBILITY_WEIGHT = 0.35;
const FUSION_WEIGHT = 0.25;
const ZONING_WEIGHT = 0.20;
const PERMIT_WEIGHT = 0.20;

/**
 * Shell interface input for new typed results
 */
export interface VerdictShellInput {
  zoning: ZoningResult;
  permits: PermitResult;
  pricing: PricingVerificationResult;
  fusion: FusionDemandResult;
  comp: CompetitivePressureResult;
  civil: CivilConstraintResult; // NEW: Civil constraints
  feasibility: FeasibilityResult;
  reverse: ReverseFeasibilityResult;
  momentum: MomentumResult;
}

/**
 * Run verdict analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @param results - All spoke results
 * @returns VerdictResult with status and PROCEED/EVALUATE/WALK decision
 */
export function runVerdictShell(
  opportunity: OpportunityObject,
  results: VerdictShellInput
): VerdictResult {
  console.log(`[VERDICT_SPOKE] Generating verdict for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    const { zoning, permits, pricing, fusion, comp, civil, feasibility, reverse, momentum } = results;

    const keyFactors: string[] = [];
    const risks: string[] = [];
    let score = 0;

    // =========================================================================
    // FEASIBILITY SCORE (30% - reduced to make room for civil)
    // =========================================================================
    const ADJUSTED_FEASIBILITY_WEIGHT = 0.30;
    if (feasibility.isViable) {
      score += ADJUSTED_FEASIBILITY_WEIGHT * 100;
      keyFactors.push(`${feasibility.roi5yr}% 5-year ROI`);
      keyFactors.push(`${feasibility.capRate}% cap rate`);
      if (feasibility.dscr && feasibility.dscr >= 1.5) {
        keyFactors.push(`Strong DSCR: ${feasibility.dscr}`);
      }
    } else {
      risks.push('Financial returns below threshold');
      if (feasibility.capRate && feasibility.capRate < 6) risks.push(`Low cap rate: ${feasibility.capRate}%`);
      if (feasibility.dscr && feasibility.dscr < 1.25) risks.push(`Weak DSCR: ${feasibility.dscr}`);
    }

    // =========================================================================
    // FUSION DEMAND SCORE (25%)
    // =========================================================================
    const fusionScore = fusion.overallScore || 50;
    score += (fusionScore / 100) * FUSION_WEIGHT * 100;

    if (fusionScore > 70) {
      keyFactors.push('Strong market demand');
    }

    if (fusion.supplyGapSqFt && fusion.supplyGapSqFt > 20000) {
      keyFactors.push(`${fusion.supplyGapSqFt.toLocaleString()} sqft supply gap`);
    } else if (fusion.supplyGapSqFt && fusion.supplyGapSqFt < 0) {
      risks.push('Oversupplied market');
    }

    if (fusion.marketTiming === 'favorable') {
      keyFactors.push('Favorable market timing');
    } else if (fusion.marketTiming === 'unfavorable') {
      risks.push('Unfavorable market timing');
    }

    // =========================================================================
    // ZONING SCORE (15% - reduced to make room for civil)
    // =========================================================================
    const ADJUSTED_ZONING_WEIGHT = 0.15;
    const zoningScore = zoning.score || 50;
    score += (zoningScore / 100) * ADJUSTED_ZONING_WEIGHT * 100;

    if (zoning.classification === 'favorable') {
      keyFactors.push('Favorable zoning');
      if (zoning.byRight) keyFactors.push('By-right approval');
    } else if (zoning.classification === 'challenging') {
      risks.push('Challenging zoning requirements');
    } else if (zoning.classification === 'prohibited') {
      risks.push('Storage not permitted - rezoning required');
    }

    if (zoning.varianceNeeded) {
      risks.push('Variance required');
    }

    // =========================================================================
    // PERMIT COMPLEXITY SCORE (15% - reduced to make room for civil)
    // =========================================================================
    const ADJUSTED_PERMIT_WEIGHT = 0.15;
    const permitComplexityScore = permits.complexity === 'low' ? 90
      : permits.complexity === 'moderate' ? 65
      : permits.complexity === 'high' ? 35
      : 15;

    score += (permitComplexityScore / 100) * ADJUSTED_PERMIT_WEIGHT * 100;

    if (permits.complexity === 'low') {
      keyFactors.push('Streamlined permitting');
    } else if (permits.complexity === 'high' || permits.complexity === 'very_high') {
      risks.push(`Complex permitting: ${permits.estimatedTimeline}`);
    }

    // =========================================================================
    // CIVIL CONSTRAINTS SCORE (15% - NEW)
    // =========================================================================
    const CIVIL_WEIGHT = 0.15;
    const civilScore = civil.civilScore || 50;
    score += (civilScore / 100) * CIVIL_WEIGHT * 100;

    if (civil.civilRating === 'favorable') {
      keyFactors.push('Favorable civil conditions');
    } else if (civil.civilRating === 'challenging') {
      risks.push('Challenging civil/site conditions');
    } else if (civil.civilRating === 'prohibitive') {
      risks.push('Prohibitive civil constraints');
    }

    // Add specific civil risk factors
    const civilRisks = getCivilRiskFactors(civil);
    risks.push(...civilRisks);

    // Add civil key factors
    if (civil.lotCoverage?.isFeasible && civil.topography?.buildableAreaReductionPct < 10) {
      keyFactors.push('Good site developability');
    }
    if (civil.stormwater?.infiltrationViability === 'high') {
      keyFactors.push('Favorable stormwater conditions');
    }

    // =========================================================================
    // COMPETITIVE PRESSURE ADJUSTMENT
    // =========================================================================
    const pressureScore = comp.pressureScore || 50;
    if (pressureScore > 70) {
      score -= 5;
      risks.push('High competitive pressure');
    } else if (pressureScore < 30) {
      score += 5;
      keyFactors.push('Low competitive pressure');
    }

    if (comp.marketSaturation === 'oversupplied') {
      score -= 10;
      risks.push('Oversaturated market');
    }

    // =========================================================================
    // DETERMINE DECISION
    // =========================================================================
    score = Math.max(0, Math.min(100, score));

    let decision: VerdictResult['decision'];
    let recommendation: VerdictResult['recommendation'];
    let recommendationText: string;
    let nextSteps: string[] = [];

    // Fatal flaws check (now includes civil)
    const hasFatalFlaw = zoning.classification === 'prohibited' ||
      comp.marketSaturation === 'oversupplied' ||
      (feasibility.dscr !== undefined && feasibility.dscr < 1.0) ||
      civil.civilRating === 'prohibitive' ||
      !civil.lotCoverage?.isFeasible;

    if (hasFatalFlaw) {
      decision = 'WALK';
      recommendation = 'WALK';
      recommendationText = 'Fatal flaw identified. This site is not viable for development.';
      nextSteps = ['Consider alternative locations', 'Review market conditions'];

      // Add specific fatal flaw reason
      if (!civil.lotCoverage?.isFeasible) {
        recommendationText += ' Lot coverage exceeds zoning limits.';
      }
      if (civil.civilRating === 'prohibitive') {
        recommendationText += ' Civil constraints are prohibitive.';
      }
    } else if (score >= 70 && feasibility.isViable) {
      decision = 'PROCEED';
      recommendation = 'BUILD';
      recommendationText = 'Strong fundamentals support development. Recommend proceeding to due diligence.';
      nextSteps = [
        'Engage civil engineer for site survey',
        'Order geotechnical report',
        'Begin zoning application',
        'Secure financing term sheet',
        'Finalize construction budget',
      ];
    } else if (score >= 45 || feasibility.isViable) {
      decision = 'EVALUATE';
      recommendation = 'EVALUATE';
      recommendationText = 'Mixed signals. Further analysis recommended before commitment.';
      nextSteps = [
        'Verify rent assumptions with additional calls',
        'Review zoning requirements in detail',
        'Order preliminary civil study',
        'Sensitivity analysis on construction costs',
        'Monitor competitive pipeline',
      ];
    } else {
      decision = 'WALK';
      recommendation = 'WALK';
      recommendationText = 'Significant challenges identified. Consider alternative sites.';
      nextSteps = ['Review other markets', 'Reassess investment criteria'];
    }

    const confidence = Math.min(95, score) / 100;

    const result: VerdictResult = {
      status: 'ok',
      recommendation,
      decision,
      confidence,
      keyFactors,
      risks,
      recommendationText,
      nextSteps,
      notes: `Verdict for ${opportunity.identity.county}, ${opportunity.identity.state}. Decision=${decision}, Score=${score}, Confidence=${(confidence * 100).toFixed(0)}%. Civil Score=${civilScore}, Rating=${civil.civilRating}.`,
    };

    console.log(`[VERDICT_SPOKE] Result: ${result.decision}, score=${score}, confidence=${(confidence * 100).toFixed(0)}%`);
    return result;
  } catch (error) {
    console.error('[VERDICT_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown verdict error',
      createStubVerdict
    );
  }
}

/**
 * Generate final verdict (Legacy Interface)
 * (Moved from pass2Calculators.ts calculateFinalVerdict)
 */
export function generateVerdict(input: VerdictInput): FinalVerdict {
  const {
    feasibility,
    fusion_demand,
    zoning_intel,
    permit_intel,
    competitive_pressure,
    toggles,
  } = input;

  console.log('[VERDICT] Generating final verdict...');

  const keyFactors: string[] = [];
  const risks: string[] = [];
  let score = 0;

  // =========================================================================
  // FEASIBILITY SCORE (35%)
  // =========================================================================
  if (feasibility.is_viable) {
    score += FEASIBILITY_WEIGHT * 100;
    keyFactors.push(`${feasibility.roi_5yr}% 5-year ROI`);
    keyFactors.push(`${feasibility.cap_rate}% cap rate`);
    if (feasibility.dscr >= 1.5) {
      keyFactors.push(`Strong DSCR: ${feasibility.dscr}`);
    }
  } else {
    risks.push('Financial returns below threshold');
    if (feasibility.cap_rate < 6) risks.push(`Low cap rate: ${feasibility.cap_rate}%`);
    if (feasibility.dscr < 1.25) risks.push(`Weak DSCR: ${feasibility.dscr}`);
  }

  // =========================================================================
  // FUSION DEMAND SCORE (25%)
  // =========================================================================
  score += (fusion_demand.overall_score / 100) * FUSION_WEIGHT * 100;

  if (fusion_demand.overall_score > 70) {
    keyFactors.push('Strong market demand');
  }

  if (fusion_demand.supply_gap_sqft > 20000) {
    keyFactors.push(`${fusion_demand.supply_gap_sqft.toLocaleString()} sqft supply gap`);
  } else if (fusion_demand.supply_gap_sqft < 0) {
    risks.push('Oversupplied market');
  }

  if (fusion_demand.market_timing === 'favorable') {
    keyFactors.push('Favorable market timing');
  } else if (fusion_demand.market_timing === 'unfavorable') {
    risks.push('Unfavorable market timing');
  }

  // =========================================================================
  // ZONING SCORE (20%)
  // =========================================================================
  score += (zoning_intel.score / 100) * ZONING_WEIGHT * 100;

  if (zoning_intel.classification === 'favorable') {
    keyFactors.push('Favorable zoning');
    if (zoning_intel.by_right) keyFactors.push('By-right approval');
  } else if (zoning_intel.classification === 'challenging') {
    risks.push('Challenging zoning requirements');
  } else if (zoning_intel.classification === 'prohibited') {
    risks.push('Storage not permitted - rezoning required');
  }

  if (zoning_intel.variance_needed) {
    risks.push('Variance required');
  }

  // =========================================================================
  // PERMIT COMPLEXITY SCORE (20%)
  // =========================================================================
  // Lower complexity = higher score
  const permitComplexityScore = permit_intel.complexity === 'low' ? 90
    : permit_intel.complexity === 'moderate' ? 65
    : permit_intel.complexity === 'high' ? 35
    : 15;

  score += (permitComplexityScore / 100) * PERMIT_WEIGHT * 100;

  if (permit_intel.complexity === 'low') {
    keyFactors.push('Streamlined permitting');
  } else if (permit_intel.complexity === 'high' || permit_intel.complexity === 'very_high') {
    risks.push(`Complex permitting: ${permit_intel.estimated_timeline}`);
  }

  // =========================================================================
  // COMPETITIVE PRESSURE ADJUSTMENT
  // =========================================================================
  if (competitive_pressure.pressure_score > 70) {
    score -= 5;
    risks.push('High competitive pressure');
  } else if (competitive_pressure.pressure_score < 30) {
    score += 5;
    keyFactors.push('Low competitive pressure');
  }

  if (competitive_pressure.market_saturation === 'oversupplied') {
    score -= 10;
    risks.push('Oversaturated market');
  }

  // =========================================================================
  // DETERMINE DECISION
  // =========================================================================
  score = Math.max(0, Math.min(100, score));

  let decision: FinalVerdict['decision'];
  let recommendation: string;
  let next_steps: string[] = [];

  // Fatal flaws check
  const hasFatalFlaw = zoning_intel.classification === 'prohibited' ||
    competitive_pressure.market_saturation === 'oversupplied' ||
    feasibility.dscr < 1.0;

  if (hasFatalFlaw) {
    decision = 'WALK';
    recommendation = 'Fatal flaw identified. This site is not viable for development.';
    next_steps = ['Consider alternative locations', 'Review market conditions'];
  } else if (score >= 70 && feasibility.is_viable) {
    decision = 'PROCEED';
    recommendation = 'Strong fundamentals support development. Recommend proceeding to due diligence.';
    next_steps = [
      'Engage site surveyor',
      'Begin zoning application',
      'Secure financing term sheet',
      'Finalize construction budget',
    ];
  } else if (score >= 45 || feasibility.is_viable) {
    decision = 'EVALUATE';
    recommendation = 'Mixed signals. Further analysis recommended before commitment.';
    next_steps = [
      'Verify rent assumptions with additional calls',
      'Review zoning requirements in detail',
      'Sensitivity analysis on construction costs',
      'Monitor competitive pipeline',
    ];
  } else {
    decision = 'WALK';
    recommendation = 'Significant challenges identified. Consider alternative sites.';
    next_steps = ['Review other markets', 'Reassess investment criteria'];
  }

  const confidence = Math.min(0.95, score / 100);

  console.log(`[VERDICT] Decision: ${decision}, Score: ${score}, Confidence: ${(confidence * 100).toFixed(0)}%`);

  return {
    decision,
    confidence,
    key_factors: keyFactors,
    risks,
    recommendation,
    next_steps,
  };
}

/**
 * Build vault payload from opportunity object
 */
export function prepareVaultPayload(
  opportunity: any // OpportunityObject - using any to avoid circular import
): any {
  console.log('[VERDICT] Preparing vault payload...');

  // TODO: Transform opportunity object to vault format
  // This should match the schema expected by saveToVault edge function

  return {
    opportunity_id: opportunity.id,
    created_at: opportunity.created_at,
    saved_at: new Date().toISOString(),
    identity: opportunity.identity,
    toggles: opportunity.toggles,
    pass1_results: opportunity.pass1_macro,
    local_scan_results: opportunity.local_scan,
    ai_caller_pricing: opportunity.ai_caller_pricing,
    pass1_recommendation: opportunity.pass1_recommendation,
    pass2_results: opportunity.pass2_results,
    final_verdict: opportunity.final_verdict,
  };
}

// Re-export types for convenience
export type { VerdictResult, VerdictShellInput };
