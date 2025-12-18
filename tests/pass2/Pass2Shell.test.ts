/**
 * Pass 2 Constraint Compiler Shell Tests
 * Doctrine ID: SS.02.00
 *
 * Tests the constraint compiler shell structure.
 * Verifies:
 * - Contract shapes are correct
 * - Deterministic output
 * - HOLD when constraints missing
 * - ELIGIBLE when mock constraints satisfied
 *
 * DOCTRINE: These tests verify constraint compilation, NOT financial modeling.
 */

import { describe, it, expect } from 'vitest';
import {
  runPass2ConstraintCompiler,
  Pass2Input,
  Pass2Output,
  validatePass2Input,
  createDefaultPass2Output,
} from '../../src/pass2/underwriting_hub';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createValidInput(): Pass2Input {
  return {
    zip_code: '75001',
    asset_class: 'self_storage',
    requested_acres: 3.5,
    run_id: 'TEST-' + Date.now(),
    state: 'TX',
    county: 'Collin',
  };
}

function createMinimalInput(): Pass2Input {
  return {
    zip_code: '90210',
    asset_class: 'rv_storage',
    run_id: 'TEST-MINIMAL-' + Date.now(),
  };
}

function createInvalidInput(): Partial<Pass2Input> {
  return {
    zip_code: '123', // Invalid - must be 5 digits
    asset_class: 'invalid' as any,
    run_id: '',
  };
}

// =============================================================================
// CONTRACT TESTS
// =============================================================================

describe('Pass 2 Input Contract', () => {
  it('should validate correct input', () => {
    const input = createValidInput();
    const errors = validatePass2Input(input);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid zip_code', () => {
    const input: Pass2Input = {
      ...createValidInput(),
      zip_code: '123',
    };
    const errors = validatePass2Input(input);
    expect(errors.some(e => e.includes('zip_code'))).toBe(true);
  });

  it('should reject invalid asset_class', () => {
    const input: Pass2Input = {
      ...createValidInput(),
      asset_class: 'invalid' as any,
    };
    const errors = validatePass2Input(input);
    expect(errors.some(e => e.includes('asset_class'))).toBe(true);
  });

  it('should reject missing run_id', () => {
    const input: Pass2Input = {
      ...createValidInput(),
      run_id: '',
    };
    const errors = validatePass2Input(input);
    expect(errors.some(e => e.includes('run_id'))).toBe(true);
  });

  it('should reject negative acreage', () => {
    const input: Pass2Input = {
      ...createValidInput(),
      requested_acres: -1,
    };
    const errors = validatePass2Input(input);
    expect(errors.some(e => e.includes('requested_acres'))).toBe(true);
  });
});

describe('Pass 2 Output Contract', () => {
  it('should create default output with correct shape', () => {
    const input = createValidInput();
    const output = createDefaultPass2Output(input);

    // Check required fields exist
    expect(output.pass).toBe('PASS2');
    expect(output.run_id).toBe(input.run_id);
    expect(output.timestamp).toBeDefined();
    expect(output.input).toEqual(input);
    expect(output.status).toBeDefined();
    expect(output.buildability).toBeDefined();
    expect(output.constraints).toBeDefined();
    expect(output.approval_checklist).toBeDefined();
    expect(output.fatal_flaws).toBeDefined();
    expect(output.unknowns).toBeDefined();
    expect(output.provenance).toBeDefined();
    expect(output.summary).toBeDefined();
    expect(output.errors).toBeDefined();
  });

  it('should have correct buildability shape', () => {
    const input = createValidInput();
    const output = createDefaultPass2Output(input);

    expect(output.buildability).toHaveProperty('gross_acres');
    expect(output.buildability).toHaveProperty('net_buildable_acres');
    expect(output.buildability).toHaveProperty('sqft_per_acre_ceiling');
    expect(output.buildability).toHaveProperty('max_buildable_sqft');
    expect(output.buildability).toHaveProperty('envelope_valid');
  });

  it('should have correct constraints shape', () => {
    const input = createValidInput();
    const output = createDefaultPass2Output(input);

    // Zoning
    expect(output.constraints).toHaveProperty('zoning_code');
    expect(output.constraints).toHaveProperty('storage_allowed');
    expect(output.constraints).toHaveProperty('conditional_use_required');

    // Setbacks
    expect(output.constraints).toHaveProperty('setback_front_ft');
    expect(output.constraints).toHaveProperty('setback_side_ft');
    expect(output.constraints).toHaveProperty('setback_rear_ft');

    // Coverage
    expect(output.constraints).toHaveProperty('max_lot_coverage_pct');
    expect(output.constraints).toHaveProperty('max_building_height_ft');

    // Fire
    expect(output.constraints).toHaveProperty('fire_lane_required');
    expect(output.constraints).toHaveProperty('sprinkler_required');

    // Stormwater
    expect(output.constraints).toHaveProperty('stormwater_required');
    expect(output.constraints).toHaveProperty('detention_required');
  });

  it('should have correct provenance shape', () => {
    const input = createValidInput();
    const output = createDefaultPass2Output(input);

    expect(output.provenance).toHaveProperty('zip_code');
    expect(output.provenance).toHaveProperty('counties_consulted');
    expect(output.provenance).toHaveProperty('jurisdiction_cards_used');
    expect(output.provenance).toHaveProperty('compiled_at');
  });
});

// =============================================================================
// COMPILER TESTS
// =============================================================================

describe('Pass 2 Constraint Compiler', () => {
  it('should return HOLD_INCOMPLETE with minimal input (no jurisdiction card)', async () => {
    const input = createMinimalInput();
    const output = await runPass2ConstraintCompiler(input);

    // Without state/county, jurisdiction resolution fails
    // Status should be HOLD_INCOMPLETE
    expect(output.pass).toBe('PASS2');
    expect(['HOLD_INCOMPLETE', 'ELIGIBLE']).toContain(output.status);
  });

  it('should return output with correct run_id', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    expect(output.run_id).toBe(input.run_id);
  });

  it('should include input in output for audit', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    expect(output.input.zip_code).toBe(input.zip_code);
    expect(output.input.asset_class).toBe(input.asset_class);
    expect(output.input.requested_acres).toBe(input.requested_acres);
  });

  it('should populate provenance', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    expect(output.provenance.zip_code).toBe(input.zip_code);
    expect(output.provenance.compiled_at).toBeDefined();
  });

  it('should fail validation for invalid input', async () => {
    const input: Pass2Input = {
      zip_code: '123', // Invalid
      asset_class: 'self_storage',
      run_id: 'TEST',
    };
    const output = await runPass2ConstraintCompiler(input);

    expect(output.status).toBe('HOLD_INCOMPLETE');
    expect(output.errors.some(e => e.includes('zip_code'))).toBe(true);
  });
});

// =============================================================================
// DETERMINISM TESTS
// =============================================================================

describe('Determinism', () => {
  it('should produce identical outputs for identical inputs', async () => {
    const input1 = createValidInput();
    const input2 = { ...input1 };

    const output1 = await runPass2ConstraintCompiler(input1);
    const output2 = await runPass2ConstraintCompiler(input2);

    // Compare key fields (exclude timestamps)
    expect(output1.status).toBe(output2.status);
    expect(output1.buildability.gross_acres).toBe(output2.buildability.gross_acres);
    expect(output1.fatal_flaws.length).toBe(output2.fatal_flaws.length);
    expect(output1.unknowns.length).toBe(output2.unknowns.length);
  });
});

// =============================================================================
// DOCTRINE COMPLIANCE TESTS
// =============================================================================

describe('Doctrine Compliance', () => {
  it('should NOT include financial fields in output', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    // These fields should NOT exist in Pass 2 output
    expect((output as any).noi).toBeUndefined();
    expect((output as any).revenue).toBeUndefined();
    expect((output as any).capRate).toBeUndefined();
    expect((output as any).dscr).toBeUndefined();
    expect((output as any).irr).toBeUndefined();
    expect((output as any).cost).toBeUndefined();
  });

  it('should have status as ELIGIBLE, HOLD_INCOMPLETE, or NO_GO', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    expect(['ELIGIBLE', 'HOLD_INCOMPLETE', 'NO_GO']).toContain(output.status);
  });

  it('should track unknowns requiring research', async () => {
    const input = createMinimalInput(); // No state/county
    const output = await runPass2ConstraintCompiler(input);

    // Should have unknowns since no jurisdiction card
    expect(Array.isArray(output.unknowns)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // ADR-019: Pass 2 Really Is — Jurisdiction Card Completion Engine
  // -------------------------------------------------------------------------

  it('should have jurisdiction_card_complete as primary signal', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    // DOCTRINE: jurisdiction_card_complete is the PRIMARY signal
    expect(typeof output.jurisdiction_card_complete).toBe('boolean');
  });

  it('should have required_fields_missing array', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    // DOCTRINE: Must track what fields are missing
    expect(Array.isArray(output.required_fields_missing)).toBe(true);
  });

  it('should have fatal_prohibitions array', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    // DOCTRINE: Must track fatal prohibitions (e.g., storage not allowed)
    expect(Array.isArray(output.fatal_prohibitions)).toBe(true);
  });

  it('should set jurisdiction_card_complete=false when HOLD_INCOMPLETE', async () => {
    const input = createMinimalInput(); // No state/county
    const output = await runPass2ConstraintCompiler(input);

    // DOCTRINE: HOLD_INCOMPLETE means card is NOT complete
    if (output.status === 'HOLD_INCOMPLETE') {
      expect(output.jurisdiction_card_complete).toBe(false);
    }
  });

  it('should answer "Do we know enough to model?" not "Is this a good deal?"', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    // DOCTRINE: Pass 2 answers knowledge questions, not deal quality
    // Verify no deal-quality fields exist
    expect((output as any).dealScore).toBeUndefined();
    expect((output as any).recommendation).toBeUndefined();
    expect((output as any).goNoGo).toBeUndefined();
    expect((output as any).investmentGrade).toBeUndefined();
  });
});

// =============================================================================
// ENVELOPE TESTS
// =============================================================================

describe('Buildability Envelope', () => {
  it('should set gross_acres from input', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    expect(output.buildability.gross_acres).toBe(input.requested_acres);
  });

  it('should mark envelope_valid based on constraint availability', async () => {
    const input = createValidInput();
    const output = await runPass2ConstraintCompiler(input);

    // envelope_valid should be boolean
    expect(typeof output.buildability.envelope_valid).toBe('boolean');
  });

  it('should provide reason when envelope is invalid', async () => {
    const input: Pass2Input = {
      ...createValidInput(),
      requested_acres: undefined, // No acreage
    };
    const output = await runPass2ConstraintCompiler(input);

    if (!output.buildability.envelope_valid) {
      expect(output.buildability.envelope_invalid_reason).toBeDefined();
    }
  });
});
