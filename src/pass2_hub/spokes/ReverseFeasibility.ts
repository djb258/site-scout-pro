/**
 * REVERSE FEASIBILITY SPOKE
 *
 * Responsibility: Calculate required rents and max land price for target returns
 *
 * Key Question: "What rents do I need to hit my target cap rate?"
 * Key Question: "What's the maximum I can pay for land?"
 *
 * Inputs:
 *   - total_development_cost: number (from feasibility)
 *   - acreage: number
 *   - cap_rate_target: number
 *   - rent_benchmarks: RentBenchmarks
 *
 * Outputs:
 *   - ReverseFeasibilityResult with required rents and max land price
 */

import type { ReverseFeasibilityResult as LegacyReverseFeasibilityResult, RentBenchmarks, OpportunityObject } from '../../shared/OpportunityObject';
import type { ReverseFeasibilityResult, PricingVerificationResult } from '../types/pass2_types';
import { createStubReverseFeasibility, createErrorResult } from '../types/pass2_types';

export interface ReverseFeasibilityInput {
  acreage: number;
  construction_cost_per_sqft?: number;
  soft_cost_pct?: number;
  cap_rate_target?: number;
  expense_ratio?: number;
  target_occupancy?: number;
  rent_benchmarks: RentBenchmarks;
}

// Defaults
const DEFAULT_CONSTRUCTION_COST_SQFT = 30; // All-in per buildable sqft
const DEFAULT_SOFT_COST_PCT = 0.15;
const DEFAULT_CAP_RATE = 0.065;
const DEFAULT_EXPENSE_RATIO = 0.35;
const DEFAULT_OCCUPANCY = 0.88;

/**
 * Run reverse feasibility analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @param pricing - PricingVerificationResult with rent benchmarks
 * @param acreage - Site acreage
 * @returns ReverseFeasibilityResult with status and required rents
 */
export function runReverseShell(
  opportunity: OpportunityObject,
  pricing: PricingVerificationResult,
  acreage: number
): ReverseFeasibilityResult {
  console.log(`[REVERSE_SPOKE] Running reverse feasibility for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    const capRateTarget = 0.065;
    const expenseRatio = 0.35;
    const targetOccupancy = 0.88;

    // Calculate buildable and rentable sqft
    const totalSqft = acreage * 43560;
    const buildableSqft = totalSqft * 0.40;
    const netRentableSqft = buildableSqft * 0.85;

    // Fixed construction costs (excluding land)
    const constructionCostPerSqft = 30;
    const constructionCost = buildableSqft * constructionCostPerSqft;
    const softCosts = constructionCost * 0.15;
    const fixedCosts = constructionCost + softCosts;

    // Assume land = $150k/acre for reverse calculation
    const assumedLandCost = acreage * 150000;
    const totalDevCost = fixedCosts + assumedLandCost;

    // Required NOI for target cap
    const requiredNOI = totalDevCost * capRateTarget;

    // Back into required GPR
    const requiredEGI = requiredNOI / (1 - expenseRatio);
    const requiredGPR = requiredEGI / targetOccupancy;
    const requiredRentPsf = Math.round(((requiredGPR / netRentableSqft) / 12) * 100) / 100;

    // Calculate required rent for 10x10 unit (100 sqft)
    const requiredRent10x10 = Math.round(requiredRentPsf * 100);

    // Calculate break-even occupancy at market rents
    const standard10x10 = pricing.standard10x10 || 125;
    const outdoor10x20 = pricing.outdoor10x20 || 95;
    const blendedMarketRent = (standard10x10 / 100 + outdoor10x20 / 200) / 2;
    const marketGPR = netRentableSqft * blendedMarketRent * 12;
    const breakEvenOccupancy = Math.round((requiredEGI / marketGPR) * 100 * 10) / 10;

    // Calculate market gap
    const marketGapPct = Math.round(((requiredRentPsf - blendedMarketRent) / blendedMarketRent) * 100 * 10) / 10;

    // Calculate max land price at market rents
    const marketNOI = marketGPR * targetOccupancy * (1 - expenseRatio);
    const maxTotalDevCost = marketNOI / capRateTarget;
    const maxLandPrice = maxTotalDevCost - fixedCosts;
    const maxLandPricePerAcre = Math.round(maxLandPrice / acreage);

    // Is the target achievable at market rents?
    const isAchievable = requiredRentPsf <= blendedMarketRent * 1.15; // Within 15% of market

    // Stabilization estimate (months to reach target occupancy)
    const stabilizationMonths = breakEvenOccupancy > 90 ? 36 : breakEvenOccupancy > 80 ? 24 : 18;

    const result: ReverseFeasibilityResult = {
      status: 'ok',
      requiredRentPsf,
      requiredRent10x10,
      breakEvenOccupancy,
      targetOccupancy: targetOccupancy * 100,
      stabilizationMonths,
      marketGapPct,
      maxLandPricePerAcre,
      isAchievable,
      notes: `STUB: Reverse feasibility for ${acreage} acres. Required Rent: $${requiredRentPsf}/sqft, Max Land: $${maxLandPricePerAcre.toLocaleString()}/acre. TODO: Calculate required rents.`,
    };

    console.log(`[REVERSE_SPOKE] Result: requiredPsf=$${result.requiredRentPsf}, maxLand=$${result.maxLandPricePerAcre?.toLocaleString()}/acre`);
    return result;
  } catch (error) {
    console.error('[REVERSE_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown reverse feasibility error',
      createStubReverseFeasibility
    );
  }
}

/**
 * Run reverse feasibility analysis (Legacy Interface)
 * (Moved from pass2Calculators.ts calculateReverseFeasibility)
 */
export function runReverseFeasibility(input: ReverseFeasibilityInput): LegacyReverseFeasibilityResult {
  const {
    acreage,
    construction_cost_per_sqft = DEFAULT_CONSTRUCTION_COST_SQFT,
    soft_cost_pct = DEFAULT_SOFT_COST_PCT,
    cap_rate_target = DEFAULT_CAP_RATE,
    expense_ratio = DEFAULT_EXPENSE_RATIO,
    target_occupancy = DEFAULT_OCCUPANCY,
    rent_benchmarks,
  } = input;

  console.log(`[REVERSE_FEASIBILITY] Calculating for ${acreage} acres, ${cap_rate_target * 100}% target cap`);

  // Calculate buildable and rentable sqft
  const totalSqft = acreage * 43560;
  const buildableSqft = totalSqft * 0.40;
  const netRentableSqft = buildableSqft * 0.85;

  // Fixed construction costs (excluding land)
  const constructionCost = buildableSqft * construction_cost_per_sqft;
  const softCosts = constructionCost * soft_cost_pct;
  const fixedCosts = constructionCost + softCosts;

  // Calculate required rent to achieve target cap at various land prices
  // NOI = (GPR × occupancy × (1 - expense_ratio))
  // Cap = NOI / Total Cost
  // Rearranging: NOI = Cap × Total Cost
  // GPR = NOI / (occupancy × (1 - expense_ratio))
  // Rent PSF = GPR / (Net Rentable Sqft × 12)

  // For now, assume we want to find required rent given a land cost assumption
  // Let's assume land = $500k (can be parameterized)
  const assumedLandCost = acreage * 150000; // $150k/acre assumption
  const totalDevCost = fixedCosts + assumedLandCost;

  // Required NOI for target cap
  const requiredNOI = totalDevCost * cap_rate_target;

  // Back into required GPR
  const requiredEGI = requiredNOI / (1 - expense_ratio);
  const requiredGPR = requiredEGI / target_occupancy;
  const required_rent_psf = (requiredGPR / netRentableSqft) / 12;

  // Calculate break-even occupancy at market rents
  const blendedMarketRent =
    (rent_benchmarks.standard_10x10 / 100 + (rent_benchmarks.outdoor_10x20 || 95) / 200) / 2;
  const marketGPR = netRentableSqft * blendedMarketRent * 12;
  const break_even_occupancy = (requiredEGI / marketGPR) * 100;

  // Calculate market gap
  const market_gap_pct = ((required_rent_psf - blendedMarketRent) / blendedMarketRent) * 100;

  // Calculate max land price
  // At market rents, what's the max we can pay for land?
  const marketNOI = marketGPR * target_occupancy * (1 - expense_ratio);
  const maxTotalDevCost = marketNOI / cap_rate_target;
  const max_land_price = maxTotalDevCost - fixedCosts;
  const max_land_price_per_acre = max_land_price / acreage;

  // Is the target achievable at market rents?
  const is_achievable = required_rent_psf <= blendedMarketRent * 1.15; // Within 15% of market

  // Stabilization estimate (months to reach target occupancy)
  const stabilization_months = break_even_occupancy > 90 ? 36 : break_even_occupancy > 80 ? 24 : 18;

  console.log(`[REVERSE_FEASIBILITY] Required Rent: $${required_rent_psf.toFixed(2)}/sqft, Max Land: $${max_land_price_per_acre.toLocaleString()}/acre`);

  return {
    required_rent_psf: Math.round(required_rent_psf * 100) / 100,
    break_even_occupancy: Math.round(break_even_occupancy * 10) / 10,
    target_occupancy: target_occupancy * 100,
    stabilization_months,
    market_gap_pct: Math.round(market_gap_pct * 10) / 10,
    is_achievable,
    max_land_price_per_acre: Math.round(max_land_price_per_acre),
  };
}

/**
 * Calculate max land budget for target returns
 */
export function calculateMaxLandBudget(
  rent_benchmarks: RentBenchmarks,
  acreage: number,
  cap_rate_target: number,
  fixed_costs_per_acre: number
): {
  max_land_per_acre: number;
  total_max_land: number;
  surplus_per_acre: number;
} {
  const totalSqft = acreage * 43560;
  const buildableSqft = totalSqft * 0.40;
  const netRentableSqft = buildableSqft * 0.85;

  const blendedRent = rent_benchmarks.avg_psf || 1.25;
  const gpr = netRentableSqft * blendedRent * 12;
  const noi = gpr * 0.88 * 0.65; // 88% occupancy, 35% expense ratio

  const maxTotalCost = noi / cap_rate_target;
  const maxTotalLand = maxTotalCost - fixed_costs_per_acre * acreage;
  const maxLandPerAcre = maxTotalLand / acreage;

  // Compare to typical land benchmark ($150k/acre)
  const benchmarkLandPerAcre = 150000;
  const surplusPerAcre = maxLandPerAcre - benchmarkLandPerAcre;

  return {
    max_land_per_acre: Math.round(maxLandPerAcre),
    total_max_land: Math.round(maxTotalLand),
    surplus_per_acre: Math.round(surplusPerAcre),
  };
}

// Re-export types for convenience
export type { ReverseFeasibilityResult };
