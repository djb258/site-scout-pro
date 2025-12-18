/**
 * Feasibility Constraint Gate Unit Tests
 * Doctrine ID: SS.02.07 (Pass 2 — Constraint Eligibility)
 *
 * Tests the constraint validation gate for Pass-2 Underwriting.
 * Covers: Input validation, Zoning constraints, Civil constraints, Eligibility determination
 *
 * DOCTRINAL NOTE: Pass 2 is CONSTRAINT-ONLY.
 * Financial calculations (NOI, DSCR, etc.) are tested in tests/pass3/Feasibility.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  runFeasibility,
  FeasibilityConstraintOutput,
  ConstraintGateInput,
} from '../../src/pass2/underwriting_hub/spokes/Feasibility';
import type { ZoningResult, CivilConstraintResult, PricingVerificationResult } from '../../src/pass2/underwriting_hub/types/pass2_types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Creates a fully-constrained eligible input
 */
function createEligibleInput(): ConstraintGateInput {
  const zoning: ZoningResult = {
    status: 'ok',
    zoningCode: 'I-2',
    storageAllowed: true,
    byRight: true,
    conditionalUseRequired: false,
    classification: 'favorable',
    notes: 'Test fixture - eligible zoning',
  };

  const civilConstraints: CivilConstraintResult = {
    status: 'ok',
    parking: {
      minStalls: 10,
      adaStalls: 1,
      maxSlopePct: 2,
      sqftPerStall: 180,
      totalParkingArea: 1800,
      meetsAdaRequirements: true,
    },
    lotCoverage: {
      allowedCoveragePct: 70,
      requiredCoveragePct: 50,
      isFeasible: true,
      maxBuildableSqft: 75000,
      buildingFootprintSqft: 50000,
      parkingFootprintSqft: 2000,
      landscapeBufferSqft: 5000,
      remainingAreaSqft: 18000,
    },
    topography: {
      avgSlopePct: 2,
      slopeBands: { flat_0_2: 80, gentle_2_5: 15, moderate_5_10: 5, steep_10_plus: 0 },
      buildableAreaReductionPct: 5,
      effectiveBuildableAcres: 2.85,
      gradingCostEstimate: 15000,
      retainingWallsRequired: false,
    },
    stormwater: {
      runoffCoefficient: 0.85,
      detentionRequired: true,
      detentionBasinAcres: 0.2,
      retentionRequired: false,
      infiltrationViability: 'medium',
      bmpRequired: true,
      estimatedCost: 50000,
    },
    bonding: {
      bondRequired: false,
      bondType: 'none',
      estimatedAmount: 0,
      letterOfCreditAccepted: true,
    },
    civilScore: 75,
    civilRating: 'favorable',
    totalCivilCostAdder: 65000,
    developableAcres: 2.85,
    notes: 'Test fixture - favorable civil constraints',
  };

  const rentBenchmarks: PricingVerificationResult = {
    status: 'ok',
    avgPsf: 1.25,
    blendedRent: 125,
    confidence: 'high',
    notes: 'Test fixture - good rent data',
  };

  return {
    acreage: 3,
    zoning,
    civilConstraints,
    rentBenchmarks,
    opportunity: {},
  };
}

/**
 * Creates input with missing acreage
 */
function createMissingAcreageInput(): ConstraintGateInput {
  return {
    acreage: undefined,
    zoning: { status: 'ok', notes: 'Test' } as ZoningResult,
    civilConstraints: { status: 'ok' } as CivilConstraintResult,
    rentBenchmarks: { status: 'ok' } as PricingVerificationResult,
  };
}

/**
 * Creates input with zero acreage
 */
function createZeroAcreageInput(): ConstraintGateInput {
  return {
    acreage: 0,
    zoning: { status: 'ok', notes: 'Test' } as ZoningResult,
    civilConstraints: { status: 'ok' } as CivilConstraintResult,
    rentBenchmarks: { status: 'ok' } as PricingVerificationResult,
  };
}

/**
 * Creates input with prohibited zoning
 */
function createProhibitedZoningInput(): ConstraintGateInput {
  return {
    acreage: 3,
    zoning: {
      status: 'ok',
      storageAllowed: false,
      classification: 'prohibited',
      notes: 'Storage not permitted',
    } as ZoningResult,
    civilConstraints: { status: 'ok', civilRating: 'favorable' } as CivilConstraintResult,
    rentBenchmarks: { status: 'ok' } as PricingVerificationResult,
  };
}

/**
 * Creates input with prohibitive civil constraints
 */
function createProhibitiveCivilInput(): ConstraintGateInput {
  return {
    acreage: 3,
    zoning: { status: 'ok', storageAllowed: true, notes: 'Test' } as ZoningResult,
    civilConstraints: {
      status: 'ok',
      civilRating: 'prohibitive',
      notes: 'Site has major constraints',
    } as CivilConstraintResult,
    rentBenchmarks: { status: 'ok' } as PricingVerificationResult,
  };
}

/**
 * Creates input with stub data (unknown)
 */
function createStubDataInput(): ConstraintGateInput {
  return {
    acreage: 3,
    zoning: { status: 'stub', notes: 'Not yet analyzed' } as ZoningResult,
    civilConstraints: { status: 'stub' } as CivilConstraintResult,
    rentBenchmarks: { status: 'stub' } as PricingVerificationResult,
  };
}

/**
 * Creates input with conditional zoning
 */
function createConditionalZoningInput(): ConstraintGateInput {
  return {
    acreage: 3,
    zoning: {
      status: 'ok',
      storageAllowed: true,
      conditionalUseRequired: true,
      classification: 'conditional',
      notes: 'CUP required',
    } as ZoningResult,
    civilConstraints: { status: 'ok', civilRating: 'favorable' } as CivilConstraintResult,
    rentBenchmarks: { status: 'ok', confidence: 'high' } as PricingVerificationResult,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Feasibility Constraint Gate (Pass 2)', () => {
  describe('Spoke Metadata', () => {
    it('should return correct spoke ID', async () => {
      const input = createEligibleInput();
      const result = await runFeasibility(input);
      expect(result.spokeId).toBe('SS.02.07');
    });

    it('should include timestamp', async () => {
      const input = createEligibleInput();
      const result = await runFeasibility(input);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('Eligible Site', () => {
    it('should pass constraints for eligible site', async () => {
      const input = createEligibleInput();
      const result = await runFeasibility(input);

      expect(result.constraints_satisfied).toBe(true);
      expect(result.eligible_for_pass3).toBe(true);
      expect(result.fatal_flaws).toHaveLength(0);
      expect(result.status).toBe('ok');
    });

    it('should be pass3_ready with all data', async () => {
      const input = createEligibleInput();
      const result = await runFeasibility(input);

      expect(result.pass3_ready).toBe(true);
      expect(result.unknowns).toHaveLength(0);
    });
  });

  describe('Acreage Validation', () => {
    it('should fail when acreage is missing', async () => {
      const input = createMissingAcreageInput();
      const result = await runFeasibility(input);

      expect(result.constraints_satisfied).toBe(false);
      expect(result.eligible_for_pass3).toBe(false);
      const flaws = result.fatal_flaws.filter(f => f.code === 'MISSING_ACREAGE');
      expect(flaws).toHaveLength(1);
    });

    it('should fail when acreage is zero', async () => {
      const input = createZeroAcreageInput();
      const result = await runFeasibility(input);

      expect(result.constraints_satisfied).toBe(false);
      const flaws = result.fatal_flaws.filter(f => f.code === 'ZERO_ACREAGE');
      expect(flaws).toHaveLength(1);
    });
  });

  describe('Zoning Constraints', () => {
    it('should fail when storage is prohibited', async () => {
      const input = createProhibitedZoningInput();
      const result = await runFeasibility(input);

      expect(result.constraints_satisfied).toBe(false);
      const flaws = result.fatal_flaws.filter(f => f.code === 'ZONING_PROHIBITED');
      expect(flaws.length).toBeGreaterThanOrEqual(1);
    });

    it('should warn but not fail when conditional use required', async () => {
      const input = createConditionalZoningInput();
      const result = await runFeasibility(input);

      expect(result.constraints_satisfied).toBe(true);
      expect(result.eligible_for_pass3).toBe(true);
      const warns = result.warnings.filter(w => w.code === 'ZONING_CONDITIONAL');
      expect(warns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Civil Constraints', () => {
    it('should fail when civil rating is prohibitive', async () => {
      const input = createProhibitiveCivilInput();
      const result = await runFeasibility(input);

      expect(result.constraints_satisfied).toBe(false);
      const flaws = result.fatal_flaws.filter(f => f.code === 'CIVIL_PROHIBITIVE');
      expect(flaws).toHaveLength(1);
    });
  });

  describe('Unknown Data Handling', () => {
    it('should track unknowns for stub data', async () => {
      const input = createStubDataInput();
      const result = await runFeasibility(input);

      expect(result.unknowns.length).toBeGreaterThan(0);
      expect(result.pass3_ready).toBe(false);
      // Stub data doesn't block eligibility, just readiness
      expect(result.eligible_for_pass3).toBe(true);
    });

    it('should identify required fields', async () => {
      const input = createStubDataInput();
      const result = await runFeasibility(input);

      const requiredUnknowns = result.unknowns.filter(u => u.required_for_pass3);
      expect(requiredUnknowns.length).toBeGreaterThan(0);
    });
  });

  describe('Notes Summary', () => {
    it('should include ELIGIBLE for passing site', async () => {
      const input = createEligibleInput();
      const result = await runFeasibility(input);

      expect(result.notes).toContain('ELIGIBLE');
    });

    it('should include BLOCKED for failing site', async () => {
      const input = createProhibitedZoningInput();
      const result = await runFeasibility(input);

      expect(result.notes).toContain('BLOCKED');
    });

    it('should mention warnings count', async () => {
      const input = createConditionalZoningInput();
      const result = await runFeasibility(input);

      if (result.warnings.length > 0) {
        expect(result.notes).toContain('warning');
      }
    });
  });
});

describe('Pass 2 vs Pass 3 Separation', () => {
  it('should NOT perform financial calculations in Pass 2', async () => {
    const input = createEligibleInput();
    const result = await runFeasibility(input);

    // Pass 2 result should not have financial fields
    expect((result as any).noi_annual).toBeUndefined();
    expect((result as any).dscr).toBeUndefined();
    expect((result as any).yield_on_cost).toBeUndefined();
    expect((result as any).gross_monthly_revenue).toBeUndefined();
  });

  it('should only validate constraints', async () => {
    const input = createEligibleInput();
    const result = await runFeasibility(input);

    // Pass 2 result should have constraint validation fields
    expect(result.constraints_satisfied).toBeDefined();
    expect(result.fatal_flaws).toBeDefined();
    expect(result.unknowns).toBeDefined();
    expect(result.eligible_for_pass3).toBeDefined();
  });
});
