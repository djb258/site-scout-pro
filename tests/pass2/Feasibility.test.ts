/**
 * Feasibility Spoke Unit Tests
 * Doctrine ID: SS.02.07
 *
 * Tests the core financial engine for Pass-2 Underwriting.
 * Covers: Revenue, NOI, DSCR, Doctrine thresholds, Fatal flaws
 */

import { describe, it, expect } from 'vitest';
import {
  runFeasibility,
  FeasibilityOutput,
  DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY,
  DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY,
  DOCTRINE_MIN_DSCR,
  DEFAULT_VACANCY_RATE,
  DEFAULT_COLLECTION_LOSS_RATE,
  DEFAULT_OPEX_RATIO,
} from '../../src/pass2/underwriting_hub/spokes/Feasibility';
import type { FeasibilityInput, PricingVerificationResult } from '../../src/pass2/underwriting_hub/types/pass2_types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Creates a passing deal input (healthy NOI, passes all doctrine checks)
 * 5 acres × $1.50/sqft × 25,000 sqft/acre = significant revenue
 */
function createPassingDealInput(): FeasibilityInput {
  const rentBenchmarks: PricingVerificationResult = {
    status: 'ok',
    avgPsf: 1.50, // $1.50/sqft/month - strong market
    blendedRent: 150,
    confidence: 'high',
    notes: 'Test fixture - passing deal',
  };

  return {
    opportunity: {} as any, // Not used in calculations
    rentBenchmarks,
    acreage: 5,
    landCostPerAcre: 100000, // $100k/acre
  };
}

/**
 * Creates a failing deal input (NOI below doctrine minimum)
 * Very low rent = insufficient NOI per acre
 *
 * Math check:
 * - 2 acres × 25,000 sqft = 50,000 sqft
 * - 50,000 × $0.25/sqft = $12,500/month gross
 * - Annual: $150,000
 * - EGI: $150,000 × 0.90 × 0.98 = $132,300
 * - NOI: $132,300 × 0.68 = $89,964
 * - NOI/acre/month: $89,964 / 2 / 12 = $3,748 (below $5,000)
 */
function createFailingNOIDealInput(): FeasibilityInput {
  const rentBenchmarks: PricingVerificationResult = {
    status: 'ok',
    avgPsf: 0.25, // $0.25/sqft/month - very weak market
    blendedRent: 25,
    confidence: 'medium',
    notes: 'Test fixture - failing NOI deal',
  };

  return {
    opportunity: {} as any,
    rentBenchmarks,
    acreage: 2,
    landCostPerAcre: 200000,
  };
}

/**
 * Creates a deal that passes NOI but fails stress test
 * Just above $5,000/acre but below $3,750 after 25% haircut
 */
function createStressTestFailureDealInput(): FeasibilityInput {
  // We need NOI/acre/month between $5,000 and $5,000 (can't be between for this test)
  // Actually: $5,000 × 0.75 = $3,750, so we need NOI/acre/month ≈ $4,500-4,999
  // This is tricky - let's calculate backwards
  // If NOI/acre/month = $4,800, stressed = $3,600 (fails)
  // But $4,800 < $5,000, so it already fails NOI check
  //
  // Actually the stress test will only fail separately if:
  // NOI/acre/month >= $5,000 AND stressed NOI/acre/month < $3,750
  // $5,000 × 0.75 = $3,750, so if NOI passes, stress always passes
  //
  // This means both tests pass or fail together mathematically
  // The stress test is redundant given current thresholds
  // Let's test a borderline case instead

  const rentBenchmarks: PricingVerificationResult = {
    status: 'ok',
    avgPsf: 1.00, // Borderline rent
    blendedRent: 100,
    confidence: 'medium',
    notes: 'Test fixture - borderline deal',
  };

  return {
    opportunity: {} as any,
    rentBenchmarks,
    acreage: 3,
    landCostPerAcre: 150000,
  };
}

/**
 * Creates a deal with low DSCR but passing NOI
 */
function createLowDSCRDealInput(): FeasibilityInput {
  const rentBenchmarks: PricingVerificationResult = {
    status: 'ok',
    avgPsf: 1.50,
    blendedRent: 150,
    confidence: 'high',
    notes: 'Test fixture - low DSCR deal',
  };

  return {
    opportunity: {} as any,
    rentBenchmarks,
    acreage: 2,
    landCostPerAcre: 500000, // Very high land cost = high debt service
  };
}

/**
 * Creates an input with zero acreage (invalid)
 */
function createZeroAcreageInput(): FeasibilityInput {
  const rentBenchmarks: PricingVerificationResult = {
    status: 'ok',
    avgPsf: 1.50,
    blendedRent: 150,
    confidence: 'high',
    notes: 'Test fixture - zero acreage',
  };

  return {
    opportunity: {} as any,
    rentBenchmarks,
    acreage: 0,
    landCostPerAcre: 100000,
  };
}

/**
 * Creates an input with no rent data (uses defaults)
 */
function createNoRentDataInput(): FeasibilityInput {
  return {
    opportunity: {} as any,
    rentBenchmarks: undefined as any,
    acreage: 5,
    landCostPerAcre: 100000,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Feasibility Spoke', () => {
  describe('Spoke Metadata', () => {
    it('should return correct spoke ID', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);
      expect(result.spokeId).toBe('SS.02.07');
    });

    it('should include timestamp', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('should echo inputs for audit', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);
      expect(result.inputs).toBeDefined();
      expect(result.inputs.acreage).toBe(5);
      expect(result.inputs.rentPsfMonthly).toBe(1.50);
    });
  });

  describe('Revenue Calculations', () => {
    it('should calculate gross monthly revenue correctly', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      // 5 acres × 25,000 sqft/acre × $1.50/sqft = $187,500/month
      const expectedMonthly = 5 * 25000 * 1.50;
      expect(result.gross_monthly_revenue).toBe(expectedMonthly);
    });

    it('should calculate gross annual revenue correctly', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      // Monthly × 12
      expect(result.gross_annual_revenue).toBe(result.gross_monthly_revenue * 12);
    });

    it('should apply vacancy and collection loss to EGI', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      // EGI = GAR × (1 - vacancy) × (1 - collection loss)
      const expectedEGI = result.gross_annual_revenue *
        (1 - DEFAULT_VACANCY_RATE) *
        (1 - DEFAULT_COLLECTION_LOSS_RATE);
      expect(result.effective_gross_income).toBeCloseTo(expectedEGI, 2);
    });
  });

  describe('NOI Calculations', () => {
    it('should calculate operating expenses as percentage of EGI', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedOpEx = result.effective_gross_income * DEFAULT_OPEX_RATIO;
      expect(result.operating_expenses).toBeCloseTo(expectedOpEx, 2);
    });

    it('should calculate NOI as EGI minus OpEx', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedNOI = result.effective_gross_income - result.operating_expenses;
      expect(result.noi_annual).toBeCloseTo(expectedNOI, 2);
    });

    it('should calculate NOI per acre per month correctly', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedNOIPerAcreMonth = result.noi_annual / 5 / 12;
      expect(result.noi_per_acre_per_month).toBeCloseTo(expectedNOIPerAcreMonth, 2);
    });

    it('should calculate stressed NOI with 25% haircut', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedStressedNOI = result.noi_annual * 0.75;
      expect(result.stressed_noi_annual).toBeCloseTo(expectedStressedNOI, 2);
    });
  });

  describe('DSCR Calculations', () => {
    it('should calculate loan amount based on LTV', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      // Loan = Total Dev Cost × 70% LTV
      const expectedLoan = result.total_development_cost * 0.70;
      expect(result.loan_amount).toBeCloseTo(expectedLoan, 2);
    });

    it('should calculate positive DSCR for viable deals', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.dscr).toBeGreaterThan(0);
      expect(result.annual_debt_service).toBeGreaterThan(0);
    });

    it('should calculate DSCR as NOI / Annual Debt Service', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedDSCR = result.noi_annual / result.annual_debt_service;
      expect(result.dscr).toBeCloseTo(expectedDSCR, 4);
    });
  });

  describe('Passing Deal', () => {
    it('should pass all doctrine checks for strong deal', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.pass_fail).toBe(true);
      expect(result.fatal_flaws).toHaveLength(0);
      expect(result.passes_doctrine_noi).toBe(true);
      expect(result.passes_stress_test).toBe(true);
    });

    it('should have NOI >= $5,000/acre/month', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.noi_per_acre_per_month).toBeGreaterThanOrEqual(DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY);
    });

    it('should have stressed NOI >= $3,750/acre/month', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.stressed_noi_per_acre_per_month).toBeGreaterThanOrEqual(DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY);
    });

    it('should return status ok', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.status).toBe('ok');
    });
  });

  describe('NOI Failure', () => {
    it('should fail when NOI below $5,000/acre/month', async () => {
      const input = createFailingNOIDealInput();
      const result = await runFeasibility(input);

      expect(result.pass_fail).toBe(false);
      expect(result.passes_doctrine_noi).toBe(false);
    });

    it('should emit NOI_BELOW_DOCTRINE fatal flaw', async () => {
      const input = createFailingNOIDealInput();
      const result = await runFeasibility(input);

      const noiFlaws = result.fatal_flaws.filter(f => f.code === 'NOI_BELOW_DOCTRINE');
      expect(noiFlaws.length).toBeGreaterThanOrEqual(1);
      expect(noiFlaws[0].severity).toBe('critical');
      expect(noiFlaws[0].threshold).toBe(DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY);
    });

    it('should include actual NOI in fatal flaw', async () => {
      const input = createFailingNOIDealInput();
      const result = await runFeasibility(input);

      const noiFlaws = result.fatal_flaws.filter(f => f.code === 'NOI_BELOW_DOCTRINE');
      expect(noiFlaws[0].actual).toBeDefined();
      expect(noiFlaws[0].actual).toBeLessThan(DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY);
    });
  });

  describe('Stressed NOI Failure', () => {
    it('should fail stress test when NOI fails', async () => {
      const input = createFailingNOIDealInput();
      const result = await runFeasibility(input);

      expect(result.passes_stress_test).toBe(false);
    });

    it('should emit STRESSED_NOI_FAILURE fatal flaw', async () => {
      const input = createFailingNOIDealInput();
      const result = await runFeasibility(input);

      const stressFlaws = result.fatal_flaws.filter(f => f.code === 'STRESSED_NOI_FAILURE');
      expect(stressFlaws.length).toBeGreaterThanOrEqual(1);
      expect(stressFlaws[0].severity).toBe('critical');
    });
  });

  describe('DSCR Warning (Not Fatal)', () => {
    it('should warn but not fail when DSCR below 1.25', async () => {
      const input = createLowDSCRDealInput();
      const result = await runFeasibility(input);

      // DSCR below threshold is a WARNING, not a fatal flaw
      const dscrWarnings = result.warnings.filter(w => w.code === 'DSCR_BELOW_THRESHOLD');

      // Check if DSCR is actually below threshold
      if (result.dscr < DOCTRINE_MIN_DSCR && result.dscr > 0) {
        expect(dscrWarnings.length).toBe(1);
        expect(dscrWarnings[0].severity).toBe('warning');
      }
    });

    it('should not have DSCR in fatal flaws', async () => {
      const input = createLowDSCRDealInput();
      const result = await runFeasibility(input);

      // DSCR issues should never appear in fatal_flaws
      const dscrFatalFlaws = result.fatal_flaws.filter(f =>
        (f.code as string).includes('DSCR')
      );
      expect(dscrFatalFlaws).toHaveLength(0);
    });
  });

  describe('Invalid Input Handling', () => {
    it('should fail with ZERO_ACREAGE for zero acreage', async () => {
      const input = createZeroAcreageInput();
      const result = await runFeasibility(input);

      expect(result.status).toBe('error');
      expect(result.pass_fail).toBe(false);

      const acreageFlaws = result.fatal_flaws.filter(f => f.code === 'ZERO_ACREAGE');
      expect(acreageFlaws).toHaveLength(1);
    });

    it('should return all zeros for invalid input', async () => {
      const input = createZeroAcreageInput();
      const result = await runFeasibility(input);

      expect(result.gross_monthly_revenue).toBe(0);
      expect(result.noi_annual).toBe(0);
      expect(result.dscr).toBe(0);
    });
  });

  describe('Missing Rent Data', () => {
    it('should use default rent when not provided', async () => {
      const input = createNoRentDataInput();
      const result = await runFeasibility(input);

      expect(result.inputs.rentPsfMonthly).toBe(1.00); // Default
    });

    it('should emit MISSING_RENT_DATA warning', async () => {
      const input = createNoRentDataInput();
      const result = await runFeasibility(input);

      const rentWarnings = result.warnings.filter(w => w.code === 'MISSING_RENT_DATA');
      expect(rentWarnings).toHaveLength(1);
    });

    it('should emit ESTIMATED_VALUES_USED warning', async () => {
      const input = createNoRentDataInput();
      const result = await runFeasibility(input);

      const estimateWarnings = result.warnings.filter(w => w.code === 'ESTIMATED_VALUES_USED');
      expect(estimateWarnings).toHaveLength(1);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for identical inputs', async () => {
      const input1 = createPassingDealInput();
      const input2 = createPassingDealInput();

      const result1 = await runFeasibility(input1);
      const result2 = await runFeasibility(input2);

      // Compare key financial metrics (exclude timestamp)
      expect(result1.gross_monthly_revenue).toBe(result2.gross_monthly_revenue);
      expect(result1.noi_annual).toBe(result2.noi_annual);
      expect(result1.dscr).toBe(result2.dscr);
      expect(result1.pass_fail).toBe(result2.pass_fail);
      expect(result1.fatal_flaws.length).toBe(result2.fatal_flaws.length);
    });
  });

  describe('Yield Calculations', () => {
    it('should calculate yield on cost', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedYield = result.noi_annual / result.total_development_cost;
      expect(result.yield_on_cost).toBeCloseTo(expectedYield, 4);
    });

    it('should calculate implied value at 7% cap', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      const expectedValue = result.noi_annual / 0.07;
      expect(result.implied_value).toBeCloseTo(expectedValue, 2);
    });

    it('should warn when yield on cost below 8%', async () => {
      const input = createLowDSCRDealInput();
      const result = await runFeasibility(input);

      if (result.yield_on_cost < 0.08) {
        const yieldWarnings = result.warnings.filter(w => w.code === 'LOW_YIELD_ON_COST');
        expect(yieldWarnings.length).toBe(1);
      }
    });
  });

  describe('Notes Summary', () => {
    it('should include acreage in notes', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.notes).toContain('5.00 acres');
    });

    it('should include PASSES for passing deal', async () => {
      const input = createPassingDealInput();
      const result = await runFeasibility(input);

      expect(result.notes).toContain('PASSES');
    });

    it('should include FAILS for failing deal', async () => {
      const input = createFailingNOIDealInput();
      const result = await runFeasibility(input);

      expect(result.notes).toContain('FAILS');
    });
  });
});

describe('Doctrine Constants', () => {
  it('should have correct NOI threshold', () => {
    expect(DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY).toBe(5000);
  });

  it('should have correct stressed NOI threshold', () => {
    expect(DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY).toBe(3750);
  });

  it('should have correct DSCR threshold', () => {
    expect(DOCTRINE_MIN_DSCR).toBe(1.25);
  });

  it('should have mathematically consistent stress test', () => {
    // Stress test is 25% haircut, so stressed threshold should be 75% of NOI threshold
    expect(DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY).toBe(DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY * 0.75);
  });
});
