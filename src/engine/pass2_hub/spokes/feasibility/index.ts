/**
 * FEASIBILITY SPOKE
 *
 * Responsibility: Calculate forward feasibility (NOI, ROI, DSCR)
 *
 * Inputs:
 *   - rent_benchmarks: RentBenchmarks
 *   - land_cost: number
 *   - acreage: number
 *   - construction_inputs: BuildInputs
 *
 * Outputs:
 *   - FeasibilityResult with financial projections
 *
 * Data Sources:
 *   - Neon: build_constants, land_cost_benchmarks
 *   - User inputs from calculator
 */

import type { FeasibilityResult as LegacyFeasibilityResult, RentBenchmarks, OpportunityObject } from '../../../shared/opportunity_object';
import type { FeasibilityResult, PricingVerificationResult } from '../../types/pass2_types';
import { createStubFeasibility, createErrorResult } from '../../types/pass2_types';

export interface FeasibilityInput {
  rent_benchmarks: RentBenchmarks;
  acreage: number;
  land_cost_per_acre: number;
  metal_building_cost_per_sqft?: number;
  concrete_cost_per_yard?: number;
  finish_labor_cost?: number;
  cap_rate_target?: number;
  expense_ratio?: number;
  target_occupancy?: number;
  ltv_ratio?: number;
  debt_rate?: number;
}

// Default construction costs (can be overridden)
const DEFAULT_METAL_COST_SQFT = 23;
const DEFAULT_CONCRETE_COST_YARD = 150;
const DEFAULT_FINISH_LABOR = 2.50;
const DEFAULT_CAP_RATE = 0.065;
const DEFAULT_EXPENSE_RATIO = 0.35;
const DEFAULT_OCCUPANCY = 0.88;
const DEFAULT_LTV = 0.70;
const DEFAULT_DEBT_RATE = 0.07;

/**
 * Run feasibility analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @param pricing - PricingVerificationResult with rent benchmarks
 * @param acreage - Site acreage
 * @param landCostPerAcre - Land cost per acre
 * @returns FeasibilityResult with status and financial projections
 */
export function runFeasibilityShell(
  opportunity: OpportunityObject,
  pricing: PricingVerificationResult,
  acreage: number,
  landCostPerAcre: number
): FeasibilityResult {
  console.log(`[FEASIBILITY_SPOKE] Running feasibility for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    // Land cost
    const landCost = acreage * landCostPerAcre;

    // Buildable sqft (assume 40% of acreage for building footprint)
    const totalSqft = acreage * 43560;
    const buildableSqft = totalSqft * 0.40;
    const netRentableSqft = Math.round(buildableSqft * 0.85); // 85% efficiency

    // Construction costs using defaults
    const constructionCostPerSqft = 30; // All-in
    const constructionCost = buildableSqft * constructionCostPerSqft;
    const softCosts = constructionCost * 0.15;
    const totalDevelopmentCost = Math.round(landCost + constructionCost + softCosts);

    // Revenue projection using pricing data
    const standard10x10 = pricing.standard10x10 || 125;
    const outdoor10x20 = pricing.outdoor10x20 || 95;
    const blendedRentPSF = (standard10x10 / 100 + outdoor10x20 / 200) / 2;
    const grossPotentialRent = netRentableSqft * blendedRentPSF * 12;
    const targetOccupancy = 0.88;
    const expenseRatio = 0.35;
    const effectiveGrossIncome = grossPotentialRent * targetOccupancy;
    const operatingExpenses = effectiveGrossIncome * expenseRatio;
    const noi = Math.round(effectiveGrossIncome - operatingExpenses);

    // Cap rate and value
    const capRateTarget = 0.065;
    const capRate = Math.round(((noi / totalDevelopmentCost) * 100) * 10) / 10;
    const stabilizedValue = Math.round(noi / capRateTarget);

    // 5-year ROI
    const appreciation = stabilizedValue - totalDevelopmentCost;
    const cashFlow5Year = noi * 5;
    const totalReturn5Year = appreciation + cashFlow5Year;
    const roi5yr = Math.round(((totalReturn5Year / totalDevelopmentCost) * 100) * 10) / 10;

    // Cash on cash (Year 1)
    const ltvRatio = 0.70;
    const debtRate = 0.07;
    const debtAmount = totalDevelopmentCost * ltvRatio;
    const equityAmount = totalDevelopmentCost * (1 - ltvRatio);
    const annualDebtService = debtAmount * debtRate;
    const cashOnCash = Math.round((((noi - annualDebtService) / equityAmount) * 100) * 10) / 10;

    // DSCR (Debt Service Coverage Ratio)
    const dscr = Math.round((annualDebtService > 0 ? noi / annualDebtService : 0) * 100) / 100;

    // Simple ROI
    const roi = Math.round(((noi / totalDevelopmentCost) * 100) * 10) / 10;

    // Viability check
    const isViable = capRate >= capRateTarget * 100 && roi5yr > 25 && dscr >= 1.25;

    const result: FeasibilityResult = {
      status: 'ok',
      landCost: Math.round(landCost),
      constructionCost: Math.round(constructionCost),
      softCosts: Math.round(softCosts),
      totalDevelopmentCost,
      netRentableSqft,
      noi,
      capRate,
      stabilizedValue,
      roi,
      roi5yr,
      cashOnCash,
      dscr,
      isViable,
      notes: `STUB: Feasibility for ${acreage} acres at $${landCostPerAcre.toLocaleString()}/acre. NOI=$${noi.toLocaleString()}, Cap=${capRate}%, Viable=${isViable}. TODO: Implement NOI/ROI/DSCR calculations.`,
    };

    console.log(`[FEASIBILITY_SPOKE] Result: NOI=$${result.noi?.toLocaleString()}, Cap=${result.capRate}%, Viable=${result.isViable}`);
    return result;
  } catch (error) {
    console.error('[FEASIBILITY_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown feasibility error',
      createStubFeasibility
    );
  }
}

/**
 * Run feasibility analysis (Legacy Interface)
 * (Moved from pass2Calculators.ts calculateFeasibility)
 */
export function runFeasibility(input: FeasibilityInput): LegacyFeasibilityResult {
  const {
    rent_benchmarks,
    acreage,
    land_cost_per_acre,
    metal_building_cost_per_sqft = DEFAULT_METAL_COST_SQFT,
    concrete_cost_per_yard = DEFAULT_CONCRETE_COST_YARD,
    finish_labor_cost = DEFAULT_FINISH_LABOR,
    cap_rate_target = DEFAULT_CAP_RATE,
    expense_ratio = DEFAULT_EXPENSE_RATIO,
    target_occupancy = DEFAULT_OCCUPANCY,
    ltv_ratio = DEFAULT_LTV,
    debt_rate = DEFAULT_DEBT_RATE,
  } = input;

  console.log(`[FEASIBILITY] Analyzing ${acreage} acres at $${land_cost_per_acre.toLocaleString()}/acre`);

  // Land cost
  const land_cost = acreage * land_cost_per_acre;

  // Buildable sqft (assume 40% of acreage for building footprint)
  const totalSqft = acreage * 43560;
  const buildableSqft = totalSqft * 0.40;
  const net_rentable_sqft = buildableSqft * 0.85; // 85% efficiency

  // Construction costs
  const metalBuildingCost = buildableSqft * metal_building_cost_per_sqft;
  const concreteCost = acreage * 200 * concrete_cost_per_yard; // 200 yards per acre
  const finishCost = buildableSqft * finish_labor_cost;
  const construction_cost = metalBuildingCost + concreteCost + finishCost;

  // Soft costs (15% of construction)
  const soft_costs = construction_cost * 0.15;

  // Total development cost
  const total_development_cost = land_cost + construction_cost + soft_costs;

  // Revenue projection (blended rate)
  const blendedRentPSF =
    (rent_benchmarks.standard_10x10 / 100 + (rent_benchmarks.outdoor_10x20 || 95) / 200) / 2;
  const grossPotentialRent = net_rentable_sqft * blendedRentPSF * 12;
  const effectiveGrossIncome = grossPotentialRent * target_occupancy;

  // Operating expenses
  const operatingExpenses = effectiveGrossIncome * expense_ratio;
  const projected_noi = effectiveGrossIncome - operatingExpenses;

  // Cap rate and value
  const cap_rate = (projected_noi / total_development_cost) * 100;
  const stabilized_value = projected_noi / cap_rate_target;

  // 5-year ROI
  const appreciation = stabilized_value - total_development_cost;
  const cashFlow5Year = projected_noi * 5;
  const totalReturn5Year = appreciation + cashFlow5Year;
  const roi_5yr = (totalReturn5Year / total_development_cost) * 100;

  // Cash on cash (Year 1)
  const debtAmount = total_development_cost * ltv_ratio;
  const equityAmount = total_development_cost * (1 - ltv_ratio);
  const annualDebtService = debtAmount * debt_rate;
  const cash_on_cash = ((projected_noi - annualDebtService) / equityAmount) * 100;

  // DSCR (Debt Service Coverage Ratio)
  const dscr = annualDebtService > 0 ? projected_noi / annualDebtService : 0;

  // Viability check
  const is_viable = cap_rate >= cap_rate_target * 100 && roi_5yr > 25 && dscr >= 1.25;

  console.log(`[FEASIBILITY] NOI: $${projected_noi.toLocaleString()}, Cap: ${cap_rate.toFixed(1)}%, Viable: ${is_viable}`);

  return {
    land_cost: Math.round(land_cost),
    construction_cost: Math.round(construction_cost),
    soft_costs: Math.round(soft_costs),
    total_development_cost: Math.round(total_development_cost),
    net_rentable_sqft: Math.round(net_rentable_sqft),
    projected_noi: Math.round(projected_noi),
    cap_rate: Math.round(cap_rate * 10) / 10,
    stabilized_value: Math.round(stabilized_value),
    roi_5yr: Math.round(roi_5yr * 10) / 10,
    cash_on_cash: Math.round(cash_on_cash * 10) / 10,
    dscr: Math.round(dscr * 100) / 100,
    is_viable,
  };
}

/**
 * Quick feasibility check (simplified)
 */
export function quickFeasibilityCheck(
  noi: number,
  total_cost: number,
  cap_rate_target: number
): { meets_target: boolean; actual_cap: number; gap_pct: number } {
  const actual_cap = total_cost > 0 ? (noi / total_cost) * 100 : 0;
  const gap_pct = cap_rate_target > 0 ? ((actual_cap - cap_rate_target * 100) / (cap_rate_target * 100)) * 100 : 0;

  return {
    meets_target: actual_cap >= cap_rate_target * 100,
    actual_cap: Math.round(actual_cap * 10) / 10,
    gap_pct: Math.round(gap_pct * 10) / 10,
  };
}

// Re-export types for convenience
export type { FeasibilityResult };
