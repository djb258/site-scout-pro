/**
 * Pass 2 Guardrail Tests
 * Doctrine ID: SS.02.GUARD
 *
 * Tests the three guardrail enhancements:
 * 1. Field Criticality Enforcement — EnvelopeReducer refuses on missing required fields
 * 2. Staleness/Revalidation Guard — Stale fields force HOLD_INCOMPLETE
 * 3. Authority Scope Tagging — Authority scope appears in output
 *
 * DOCTRINE: No silent partial envelopes. No stale data masquerading as current.
 */

import { describe, it, expect } from 'vitest';
import { runEnvelopeReducer } from '../../src/pass2/underwriting_hub/spokes/EnvelopeReducer';
import {
  createDefaultPass2Output,
  runPass2ConstraintCompiler,
  Pass2Input,
} from '../../src/pass2/underwriting_hub';
import type { EnvelopeReducerInput } from '../../src/pass2/underwriting_hub/types/constraint_types';
import {
  checkEnvelopeRequirements,
  createConstraintField,
  createUnknownField,
  isEffectivelyUnknown,
  type ConstraintField,
} from '../../src/pass2/underwriting_hub/types/guardrails';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createCompleteEnvelopeInput(): EnvelopeReducerInput {
  return {
    gross_acres: 3.5,
    asset_class: 'self_storage',
    zoning: {
      spoke_id: 'SS.02.03',
      status: 'ok',
      timestamp: new Date().toISOString(),
      notes: 'Complete zoning',
      zoning_code: 'C-2',
      storage_allowed: true,
      conditional_use_required: false,
      variance_required: false,
      setbacks: {
        front_ft: 25,
        side_ft: 15,
        rear_ft: 20,
      },
      max_height_ft: 45,
      max_stories: 3,
      max_lot_coverage_pct: 60,
      floor_area_ratio: 1.5,
    },
    site_plan: {
      spoke_id: 'SS.02.04',
      status: 'ok',
      timestamp: new Date().toISOString(),
      notes: 'Complete site plan',
      min_parking_spaces: 10,
      ada_spaces_required: 1,
      landscape_buffer_ft: 10,
      landscape_pct_required: 15,
    },
    stormwater: {
      spoke_id: 'SS.02.05',
      status: 'ok',
      timestamp: new Date().toISOString(),
      notes: 'Complete stormwater',
      stormwater_plan_required: true,
      detention_required: true,
      retention_required: false,
      infiltration_allowed: true,
      estimated_detention_acres: 0.2,
    },
    fire_access: {
      spoke_id: 'SS.02.06',
      status: 'ok',
      timestamp: new Date().toISOString(),
      notes: 'Complete fire access',
      fire_lane_required: true,
      fire_lane_width_ft: 20,
      hydrant_spacing_ft: 400,
      sprinkler_required: true,
    },
  };
}

function createIncompleteEnvelopeInput(): EnvelopeReducerInput {
  const input = createCompleteEnvelopeInput();
  // Make setbacks unknown
  input.zoning.setbacks.front_ft = null;
  input.zoning.setbacks.side_ft = null;
  input.zoning.setbacks.rear_ft = null;
  return input;
}

function createValidPass2Input(): Pass2Input {
  return {
    zip_code: '75001',
    asset_class: 'self_storage',
    requested_acres: 3.5,
    run_id: 'TEST-GUARD-' + Date.now(),
    state: 'TX',
    county: 'Collin',
  };
}

// =============================================================================
// 1. FIELD CRITICALITY ENFORCEMENT TESTS
// =============================================================================

describe('Guardrail 1: Field Criticality Enforcement', () => {
  it('should REFUSE envelope calculation when required fields are missing', async () => {
    const input = createIncompleteEnvelopeInput();
    const result = await runEnvelopeReducer(input);

    // GUARDRAIL: Must refuse, not calculate partial
    expect(result.envelope_valid).toBe(false);
    expect(result.status).toBe('error');
    expect(result.missing_constraints.length).toBeGreaterThan(0);
    expect(result.notes).toContain('GUARDRAIL');
  });

  it('should ALLOW envelope calculation when all required fields are present', async () => {
    const input = createCompleteEnvelopeInput();
    const result = await runEnvelopeReducer(input);

    // With complete input, should calculate
    expect(result.envelope_valid).toBe(true);
    expect(result.net_buildable_acres).not.toBeNull();
    expect(result.max_buildable_sqft).not.toBeNull();
  });

  it('should list ALL missing required fields, not just the first', async () => {
    const input = createCompleteEnvelopeInput();
    // Make multiple fields unknown
    input.zoning.setbacks.front_ft = null;
    input.zoning.max_lot_coverage_pct = null;
    input.fire_access.fire_lane_required = null;

    const result = await runEnvelopeReducer(input);

    // Should list all three missing fields
    expect(result.missing_constraints.length).toBeGreaterThanOrEqual(3);
    expect(result.missing_constraints.some(f => f.includes('setback'))).toBe(true);
    expect(result.missing_constraints.some(f => f.includes('coverage'))).toBe(true);
    expect(result.missing_constraints.some(f => f.includes('fire'))).toBe(true);
  });

  it('should not produce net_buildable_acres when required fields missing', async () => {
    const input = createIncompleteEnvelopeInput();
    const result = await runEnvelopeReducer(input);

    // GUARDRAIL: No partial results
    expect(result.net_buildable_acres).toBeNull();
    expect(result.max_buildable_sqft).toBeNull();
  });
});

// =============================================================================
// 2. STALENESS / REVALIDATION GUARD TESTS
// =============================================================================

describe('Guardrail 2: Staleness / Revalidation Guard', () => {
  it('should treat fields with revalidation_required=true as unknown', () => {
    const field: ConstraintField<number> = createConstraintField(25, 'REQUIRED_FOR_ENVELOPE', {
      state: 'known',
      revalidation_required: true,  // STALE
    });

    // GUARDRAIL: Stale = unknown
    expect(isEffectivelyUnknown(field)).toBe(true);
  });

  it('should NOT treat fresh known fields as unknown', () => {
    const field: ConstraintField<number> = createConstraintField(25, 'REQUIRED_FOR_ENVELOPE', {
      state: 'known',
      revalidation_required: false,  // Fresh
      verified_at: new Date().toISOString(),
    });

    expect(isEffectivelyUnknown(field)).toBe(false);
  });

  it('should track stale_fields in provenance', () => {
    const input = createValidPass2Input();
    const output = createDefaultPass2Output(input);

    // Default output should have stale_fields array
    expect(Array.isArray(output.provenance.stale_fields)).toBe(true);
  });

  it('should treat blocked fields as effectively unknown', () => {
    const field: ConstraintField<number> = createConstraintField(null, 'REQUIRED_FOR_ENVELOPE', {
      state: 'blocked',  // Research attempted, couldn't determine
    });

    expect(isEffectivelyUnknown(field)).toBe(true);
  });
});

// =============================================================================
// 3. AUTHORITY SCOPE TAGGING TESTS
// =============================================================================

describe('Guardrail 3: Authority Scope Tagging', () => {
  it('should have authorities_consulted in provenance', () => {
    const input = createValidPass2Input();
    const output = createDefaultPass2Output(input);

    // GUARDRAIL: Must track which authorities were consulted
    expect(output.provenance.authorities_consulted).toBeDefined();
    expect(typeof output.provenance.authorities_consulted.county).toBe('boolean');
    expect(typeof output.provenance.authorities_consulted.municipality).toBe('boolean');
    expect(typeof output.provenance.authorities_consulted.watershed).toBe('boolean');
    expect(typeof output.provenance.authorities_consulted.state).toBe('boolean');
    expect(typeof output.provenance.authorities_consulted.fire_district).toBe('boolean');
    expect(typeof output.provenance.authorities_consulted.dot).toBe('boolean');
  });

  it('should default all authorities to not consulted', () => {
    const input = createValidPass2Input();
    const output = createDefaultPass2Output(input);

    // Default: no authorities consulted yet
    expect(output.provenance.authorities_consulted.county).toBe(false);
    expect(output.provenance.authorities_consulted.municipality).toBe(false);
    expect(output.provenance.authorities_consulted.watershed).toBe(false);
  });

  it('should have authority_scope field in constraint field type', () => {
    const field = createConstraintField(25, 'REQUIRED_FOR_ENVELOPE', {
      authority_scope: 'county',
    });

    expect(field.authority_scope).toBe('county');
  });

  it('should default authority_scope to unknown when not provided', () => {
    const field = createUnknownField('REQUIRED_FOR_ENVELOPE');

    expect(field.authority_scope).toBe('unknown');
  });
});

// =============================================================================
// DETERMINISM TESTS (Must remain intact)
// =============================================================================

describe('Guardrail Determinism', () => {
  it('should produce identical envelope refusals for identical missing inputs', async () => {
    const input1 = createIncompleteEnvelopeInput();
    const input2 = createIncompleteEnvelopeInput();

    const result1 = await runEnvelopeReducer(input1);
    const result2 = await runEnvelopeReducer(input2);

    // Same missing fields should produce same refusal
    expect(result1.envelope_valid).toBe(result2.envelope_valid);
    expect(result1.missing_constraints).toEqual(result2.missing_constraints);
  });

  it('should produce identical envelope calculations for identical complete inputs', async () => {
    const input1 = createCompleteEnvelopeInput();
    const input2 = createCompleteEnvelopeInput();

    const result1 = await runEnvelopeReducer(input1);
    const result2 = await runEnvelopeReducer(input2);

    expect(result1.net_buildable_acres).toBe(result2.net_buildable_acres);
    expect(result1.max_buildable_sqft).toBe(result2.max_buildable_sqft);
  });
});

// =============================================================================
// INTEGRATION: Full Pass 2 with Guardrails
// =============================================================================

describe('Guardrails Integration', () => {
  it('should propagate envelope refusal to Pass 2 status', async () => {
    // Minimal input will result in missing constraints
    const input: Pass2Input = {
      zip_code: '90210',
      asset_class: 'self_storage',
      run_id: 'TEST-INTEGRATION-' + Date.now(),
      // No state/county = jurisdiction will be incomplete
    };

    const output = await runPass2ConstraintCompiler(input);

    // Should be HOLD_INCOMPLETE due to missing data
    expect(output.status).toBe('HOLD_INCOMPLETE');
    expect(output.jurisdiction_card_complete).toBe(false);
  });

  it('should include authority scope in full Pass 2 output', async () => {
    const input = createValidPass2Input();
    const output = await runPass2ConstraintCompiler(input);

    // Authority scope should be in provenance
    expect(output.provenance.authorities_consulted).toBeDefined();
  });
});
