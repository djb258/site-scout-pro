/**
 * PASS 2 ORCHESTRATOR
 *
 * Coordinates all Pass 2 spokes in sequence using new shell interfaces:
 *   1. runZoningShell() - Fetch zoning regulations
 *   2. runPermitShell() - Fetch permit requirements
 *   3. runPricingShell() - Verify and consolidate pricing
 *   4. runMomentumShell() - Combined industrial + housing analysis
 *   5. runFusionShell() - Calculate fusion demand score
 *   6. runCompPressureShell() - Analyze competitive pressure
 *   7. runFeasibilityShell() - Calculate financial feasibility
 *   8. runReverseShell() - Calculate required rents / max land
 *   9. runVerdictShell() - Generate BUY/BUILD/WALK decision
 *  10. prepareVaultPayload() - Build vault-ready payload
 *
 * Input: OpportunityObject from Pass 1
 * Output: Pass2Output with all typed spoke results
 */

import type {
  OpportunityObject,
  Pass2Results,
  FinalVerdict,
} from '../../shared/opportunity_object';

// Validation import
import {
  validatePass1ToPass2,
  createValidationSummary,
  type Pass1ToPass2Validation,
} from '../../shared/validators/p1_to_p2_validator';

// New typed imports from pass2_types
import type {
  Pass2Output as TypedPass2Output,
  ZoningResult,
  PermitResult,
  PricingVerificationResult,
  FusionDemandResult,
  CompetitivePressureResult,
  CivilConstraintResult,
  FeasibilityResult,
  ReverseFeasibilityResult,
  MomentumResult,
  VerdictResult,
  VaultPayload,
} from '../types/pass2_types';
import {
  createStubZoning,
  createStubPermit,
  createStubPricing,
  createStubFusion,
  createStubCompetitivePressure,
  createStubCivilConstraints,
  createStubFeasibility,
  createStubReverseFeasibility,
  createStubMomentum,
  createStubVerdict,
  createStubVaultPayload,
} from '../types/pass2_types';

// New shell imports
import { runZoningShell, runZoning } from '../spokes/zoning';
import { runPermitShell, runPermits } from '../spokes/permits';
import { runPricingShell, runPricingVerification, checkPricingExists } from '../spokes/pricing_verification';
import { runFusionShell, runFusionDemand } from '../spokes/fusion_demand';
import { runCompPressureShell, runCompPressure } from '../spokes/competitive_pressure';
import { runCivilConstraintsShell } from '../spokes/civil_constraints';
import { runFeasibilityShell, runFeasibility } from '../spokes/feasibility';
import { runReverseShell, runReverseFeasibility } from '../spokes/reverse_feasibility';
import { runMomentumShell, runIndustrialMomentum } from '../spokes/industrial_momentum';
import { runHousingPipeline } from '../spokes/housing_pipeline';
import { runVerdictShell, generateVerdict, prepareVaultPayload } from '../spokes/verdict';
import { runVaultMapperShell } from '../spokes/vault_mapper';
import { writeLog, writeData, TABLES } from '../../shared/lovable_adapter';

export interface Pass2Input {
  opportunity: OpportunityObject;
  acreage?: number;
  land_cost_per_acre?: number;
  /** Skip validation gate (for testing/override) */
  skip_validation?: boolean;
}

// Legacy output type (for backwards compatibility)
export interface Pass2Output {
  success: boolean;
  opportunity: OpportunityObject | null;
  error?: string;
}

/**
 * NEW Pass 2 Orchestrator Shell
 *
 * Uses new typed shell interfaces for all spokes.
 * Includes Pass-1 → Pass-2 validation gate.
 * Civil constraints run EARLY and feed into feasibility + verdict.
 * Returns TypedPass2Output with all results.
 */
export async function runPass2Shell(input: Pass2Input): Promise<TypedPass2Output> {
  const { opportunity, acreage = 3, land_cost_per_acre = 150000, skip_validation = false } = input;
  const timestamp = Date.now();
  const runId = `p2_${opportunity.identity.zip}_${timestamp}`;

  console.log(`[PASS2_ORCHESTRATOR] Starting Pass 2 Shell for ZIP: ${opportunity.identity.zip}`);

  try {
    // =========================================================================
    // STEP 0: VALIDATION GATE - Verify Pass-1 data is complete
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 0: Running validation gate...');
    const validation = validatePass1ToPass2(opportunity);
    console.log(`[PASS2_ORCHESTRATOR] ${createValidationSummary(validation)}`);

    if (!validation.ok && !skip_validation) {
      console.error('[PASS2_ORCHESTRATOR] Validation FAILED. Blockers:', validation.blockers);

      await writeLog('pass2_validation_failed', {
        run_id: runId,
        zip: opportunity.identity.zip,
        blockers: validation.blockers,
        warnings: validation.warnings,
        validation_score: validation.validation_meta.validation_score,
      });

      // Return error result with validation details
      return {
        success: false,
        runId,
        timestamp,
        zoning: createStubZoning(),
        permits: createStubPermit(),
        pricing: createStubPricing(),
        fusion: createStubFusion(),
        comp: createStubCompetitivePressure(),
        civil: createStubCivilConstraints(),
        feasibility: createStubFeasibility(),
        reverse: createStubReverseFeasibility(),
        momentum: createStubMomentum(),
        verdict: createStubVerdict(),
        vaultPayload: createStubVaultPayload(),
        error: `Validation failed: ${validation.blockers.join('; ')}`,
        validation,
      };
    }

    if (skip_validation && !validation.ok) {
      console.warn(`[PASS2_ORCHESTRATOR] Validation skipped despite ${validation.blockers.length} blockers`);
    }

    // Log warnings even if validation passed
    if (validation.warnings.length > 0) {
      console.warn(`[PASS2_ORCHESTRATOR] Validation warnings: ${validation.warnings.join('; ')}`);
    }

    // =========================================================================
    // STEP 1: Run Zoning Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 1: Running zoning shell...');
    const zoning = await runZoningShell(opportunity);

    // =========================================================================
    // STEP 2: Run Permit Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 2: Running permit shell...');
    const permits = await runPermitShell(opportunity);

    // =========================================================================
    // STEP 3: Run Civil Constraints Analysis (NEW - EARLY)
    // Must run before feasibility to provide cost adjustments
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 3: Running civil constraints shell...');
    const civil = await runCivilConstraintsShell(opportunity, acreage, zoning);

    // =========================================================================
    // STEP 4: Run Pricing Verification
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 4: Running pricing shell...');
    const pricing = await runPricingShell(opportunity);

    // =========================================================================
    // STEP 5: Run Momentum Analysis (Combined Industrial + Housing)
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 5: Running momentum shell...');
    const momentum = await runMomentumShell(opportunity);

    // =========================================================================
    // STEP 6: Run Fusion Demand Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 6: Running fusion shell...');
    const fusion = runFusionShell(opportunity, momentum);

    // =========================================================================
    // STEP 7: Run Competitive Pressure Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 7: Running comp pressure shell...');
    const comp = await runCompPressureShell(opportunity);

    // =========================================================================
    // STEP 8: Run Feasibility Analysis (consumes civil constraints)
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 8: Running feasibility shell...');
    const feasibility = runFeasibilityShell(opportunity, pricing, acreage, land_cost_per_acre, civil);

    // =========================================================================
    // STEP 9: Run Reverse Feasibility
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 9: Running reverse shell...');
    const reverse = runReverseShell(opportunity, pricing, acreage);

    // =========================================================================
    // STEP 10: Generate Final Verdict (consumes civil constraints)
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 10: Running verdict shell...');
    const verdict = runVerdictShell(opportunity, {
      zoning,
      permits,
      pricing,
      fusion,
      comp,
      civil,
      feasibility,
      reverse,
      momentum,
    });

    // =========================================================================
    // STEP 11: Build Vault Payload using Vault Mapper
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 11: Building vault payload...');
    const vaultPayload = await runVaultMapperShell({
      opportunity,
      zoning,
      permits,
      pricing,
      fusion,
      comp,
      civil,
      feasibility,
      reverse,
      momentum,
      verdict,
    });

    // =========================================================================
    // STEP 12: Store intermediate results to pass2_runs scratchpad
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 12: Storing run results...');
    await writeData(TABLES.PASS2_RUNS, {
      run_id: runId,
      opportunity_id: opportunity.id,
      zip: opportunity.identity.zip,
      county: opportunity.identity.county,
      state: opportunity.identity.state,
      decision: verdict.decision,
      confidence: verdict.confidence,
      cap_rate: feasibility.capRate,
      noi: feasibility.noi,
      is_viable: feasibility.isViable,
      civil_score: civil.civilScore,
      civil_rating: civil.civilRating,
      civil_cost_adder: civil.totalCivilCostAdder,
      timestamp,
    });

    // Store staging payload for vault save
    await writeData(TABLES.STAGING_PAYLOAD, {
      run_id: runId,
      opportunity_id: opportunity.id,
      payload: vaultPayload.payload,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    await writeLog('pass2_complete', {
      run_id: runId,
      zip: opportunity.identity.zip,
      decision: verdict.decision,
      confidence: verdict.confidence,
      cap_rate: feasibility.capRate,
      civil_score: civil.civilScore,
      civil_rating: civil.civilRating,
    });

    console.log(`[PASS2_ORCHESTRATOR] Pass 2 Shell complete. Verdict: ${verdict.decision}, Civil: ${civil.civilRating}`);

    return {
      success: true,
      runId,
      timestamp,
      zoning,
      permits,
      pricing,
      fusion,
      comp,
      civil,
      feasibility,
      reverse,
      momentum,
      verdict,
      vaultPayload,
    };
  } catch (error) {
    console.error('[PASS2_ORCHESTRATOR] Shell Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      runId,
      timestamp,
      zoning: createStubZoning(),
      permits: createStubPermit(),
      pricing: createStubPricing(),
      fusion: createStubFusion(),
      comp: createStubCompetitivePressure(),
      civil: createStubCivilConstraints(),
      feasibility: createStubFeasibility(),
      reverse: createStubReverseFeasibility(),
      momentum: createStubMomentum(),
      verdict: createStubVerdict(),
      vaultPayload: createStubVaultPayload(),
      error: errorMessage,
    };
  }
}

/**
 * Main Pass 2 Orchestrator (Legacy)
 */
export async function runPass2(input: Pass2Input): Promise<Pass2Output> {
  const { opportunity, acreage = 3, land_cost_per_acre = 150000 } = input;

  console.log(`[PASS2_ORCHESTRATOR] Starting Pass 2 for ZIP: ${opportunity.identity.zip}`);

  // Validate Pass 1 completion
  if (opportunity.status !== 'pass1_complete' && opportunity.status !== 'local_scan_complete') {
    return {
      success: false,
      opportunity: null,
      error: 'Pass 1 must be complete before running Pass 2',
    };
  }

  try {
    // =========================================================================
    // STEP 1: Check Pricing Data Exists
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 1: Checking pricing data...');
    // Pricing verification will handle missing data with defaults

    // =========================================================================
    // STEP 2: Run Zoning Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 2: Running zoning analysis...');
    const zoningResult = await runZoning({
      state: opportunity.identity.state,
      county: opportunity.identity.county,
      zip: opportunity.identity.zip,
      county_fips: opportunity.identity.county_fips,
    });

    if (!zoningResult.success || !zoningResult.zoning_intel) {
      console.warn('[PASS2_ORCHESTRATOR] Zoning analysis failed, using defaults');
    }

    // =========================================================================
    // STEP 3: Run Permit Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 3: Running permit analysis...');
    const permitResult = await runPermits({
      state: opportunity.identity.state,
      county: opportunity.identity.county,
      county_fips: opportunity.identity.county_fips,
    });

    if (!permitResult.success || !permitResult.permit_intel) {
      console.warn('[PASS2_ORCHESTRATOR] Permit analysis failed, using defaults');
    }

    // =========================================================================
    // STEP 4: Run Pricing Verification
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 4: Running pricing verification...');
    const pricingResult = await runPricingVerification({
      ai_caller_pricing: opportunity.ai_caller_pricing,
      competitors: opportunity.local_scan?.local_competitors,
      state: opportunity.identity.state,
      county_fips: opportunity.identity.county_fips,
    });

    if (!pricingResult.success || !pricingResult.rent_benchmarks) {
      console.warn('[PASS2_ORCHESTRATOR] Pricing verification failed, using defaults');
    }

    // Use defaults if not available
    const rent_benchmarks = pricingResult.rent_benchmarks || {
      climate_control_10x10: 185,
      standard_10x10: 125,
      outdoor_10x20: 95,
      market_position: 'competitive' as const,
      avg_psf: 1.25,
      data_sources: [],
      confidence: 'low' as const,
    };

    // =========================================================================
    // STEP 5: Run Industrial Momentum (Deep Dive)
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 5: Running industrial deep dive...');
    const industrialResult = await runIndustrialMomentum({
      pass1_industrial: opportunity.pass1_macro.industrial_signals,
      state: opportunity.identity.state,
      county: opportunity.identity.county,
      county_fips: opportunity.identity.county_fips,
    });

    const industrial_momentum = industrialResult.industrial_momentum || {
      growth_rate_pct: 0,
      major_employers: [],
      logistics_score: 50,
      warehouse_vacancy_pct: 5,
      new_industrial_sqft: 0,
      momentum_rating: 'weak' as const,
    };

    // =========================================================================
    // STEP 6: Run Housing Pipeline Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 6: Running housing pipeline analysis...');
    const housingResult = await runHousingPipeline({
      pass1_housing: opportunity.pass1_macro.housing_signals,
      state: opportunity.identity.state,
      county: opportunity.identity.county,
      county_fips: opportunity.identity.county_fips,
    });

    const housing_pipeline = housingResult.housing_pipeline || {
      new_units_planned: 0,
      construction_timeline: 'unknown',
      density_trend: 'stable' as const,
      multifamily_share_pct: 35,
      demand_projection_sqft: 0,
      timeline_alignment: 'neutral' as const,
    };

    // =========================================================================
    // STEP 7: Run Fusion Demand Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 7: Running fusion demand analysis...');
    const fusion_demand = runFusionDemand({
      pass1_macro: opportunity.pass1_macro,
      industrial_momentum,
      housing_pipeline,
    });

    // =========================================================================
    // STEP 8: Run Competitive Pressure Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 8: Running competitive pressure analysis...');
    const compPressureResult = await runCompPressure({
      competitors: opportunity.pass1_macro.competitors,
      macro_demand: opportunity.pass1_macro.macro_demand,
      state: opportunity.identity.state,
      county_fips: opportunity.identity.county_fips,
    });

    const competitive_pressure = compPressureResult.competitive_pressure || {
      competitor_count_5mi: 0,
      competitor_count_10mi: 0,
      sqft_per_capita: 0,
      market_saturation: 'balanced' as const,
      new_supply_pipeline: 0,
      pressure_score: 50,
    };

    // =========================================================================
    // STEP 9: Run Feasibility Analysis
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 9: Running feasibility analysis...');
    const feasibility = runFeasibility({
      rent_benchmarks,
      acreage,
      land_cost_per_acre,
    });

    // =========================================================================
    // STEP 10: Run Reverse Feasibility
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 10: Running reverse feasibility...');
    const reverse_feasibility = runReverseFeasibility({
      acreage,
      rent_benchmarks,
    });

    // =========================================================================
    // STEP 11: Generate Final Verdict
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 11: Generating verdict...');

    const zoning_intel = zoningResult.zoning_intel || {
      primary_zone: 'Unknown',
      storage_allowed: true,
      by_right: false,
      conditional_use_required: true,
      variance_needed: false,
      classification: 'conditional' as const,
      score: 60,
    };

    const permit_intel = permitResult.permit_intel || {
      estimated_timeline: '90-120 days',
      total_fees: 15000,
      complexity: 'moderate' as const,
      key_requirements: [],
      critical_path: [],
    };

    const final_verdict = generateVerdict({
      feasibility,
      fusion_demand,
      zoning_intel,
      permit_intel,
      competitive_pressure,
      toggles: opportunity.toggles,
    });

    // =========================================================================
    // STEP 12: Assemble Pass 2 Results
    // =========================================================================
    console.log('[PASS2_ORCHESTRATOR] Step 12: Assembling results...');

    const pass2_results: Pass2Results = {
      zoning_intel,
      permit_intel,
      rent_benchmarks,
      rent_curve_model: pricingResult.rent_curve_model || undefined,
      fusion_demand,
      competitive_pressure,
      feasibility,
      reverse_feasibility,
      industrial_momentum,
      housing_pipeline,
    };

    // Update opportunity object
    opportunity.pass2_results = pass2_results;
    opportunity.final_verdict = final_verdict;
    opportunity.pass2_completed_at = new Date().toISOString();
    opportunity.status = 'pass2_complete';

    console.log(`[PASS2_ORCHESTRATOR] Pass 2 complete. Verdict: ${final_verdict.decision}`);

    return {
      success: true,
      opportunity,
    };
  } catch (error) {
    console.error('[PASS2_ORCHESTRATOR] Error:', error);
    return {
      success: false,
      opportunity: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Prepare opportunity for vault save
 */
export function prepareForVault(opportunity: OpportunityObject): {
  vault_payload: any;
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (opportunity.status !== 'pass2_complete') {
    missing.push('Pass 2 not complete');
  }

  if (!opportunity.final_verdict) {
    missing.push('Final verdict not generated');
  }

  if (!opportunity.pass2_results) {
    missing.push('Pass 2 results not available');
  }

  if (missing.length > 0) {
    return {
      vault_payload: null,
      ready: false,
      missing,
    };
  }

  return {
    vault_payload: prepareVaultPayload(opportunity),
    ready: true,
    missing: [],
  };
}

// Re-export types for convenience
export type {
  TypedPass2Output,
  ZoningResult,
  PermitResult,
  PricingVerificationResult,
  FusionDemandResult,
  CompetitivePressureResult,
  CivilConstraintResult,
  FeasibilityResult,
  ReverseFeasibilityResult,
  MomentumResult,
  VerdictResult,
  VaultPayload,
};
