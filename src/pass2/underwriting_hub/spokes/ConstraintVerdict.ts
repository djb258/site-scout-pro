// =============================================================================
// CONSTRAINT VERDICT — Spoke SS.02.09
// =============================================================================
// Doctrine ID: SS.02.09
// Purpose: Compile final constraint verdict (ELIGIBLE / HOLD / NO_GO)
//
// DOCTRINE: This verdict is about CONSTRAINTS, not financials.
// - ELIGIBLE: Constraints compiled. Site can physically be developed.
// - HOLD_INCOMPLETE: Missing critical constraints. Manual research required.
// - NO_GO: Fatal constraint violation. Site cannot be developed.
//
// NO financial judgment. NO revenue assessment. NO cost analysis.
// =============================================================================

import type {
  ConstraintVerdictInput,
  ConstraintVerdictResult,
  JurisdictionResolverResult,
  JurisdictionCardReaderResult,
  ZoningConstraintsResult,
  SitePlanConstraintsResult,
  StormwaterConstraintsResult,
  FireAccessConstraintsResult,
  PermittingChecklistResult,
  EnvelopeReducerResult,
} from '../types/constraint_types';

/**
 * Compile constraint verdict from all spoke results.
 */
export async function runConstraintVerdict(
  input: ConstraintVerdictInput
): Promise<ConstraintVerdictResult> {
  const timestamp = new Date().toISOString();

  console.log('[SS.02.09] Compiling constraint verdict');

  const fatalFlaws: string[] = [];
  const unknowns: {
    field: string;
    impact: string;
    research_method: string;
    blocks_pass3: boolean;
  }[] = [];

  // ---------------------------------------------------------------------------
  // CHECK 1: Jurisdiction Resolution
  // ---------------------------------------------------------------------------

  if (!input.jurisdiction.primary_jurisdiction) {
    unknowns.push({
      field: 'jurisdiction',
      impact: 'Cannot determine applicable regulations',
      research_method: 'Geocode address or provide state/county',
      blocks_pass3: true,
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK 2: Zoning - Is Storage Allowed?
  // ---------------------------------------------------------------------------

  if (input.zoning.storage_allowed === false) {
    fatalFlaws.push('ZONING_PROHIBITED: Storage use not allowed in this zone');
  } else if (input.zoning.storage_allowed === null) {
    unknowns.push({
      field: 'zoning.storage_allowed',
      impact: 'Cannot confirm if storage is permitted',
      research_method: 'Review zoning code or contact planning department',
      blocks_pass3: true,
    });
  }

  if (input.zoning.variance_required === true) {
    // Not fatal but high risk
    unknowns.push({
      field: 'zoning.variance',
      impact: 'Variance required - approval uncertain',
      research_method: 'Pre-application meeting with planning staff',
      blocks_pass3: false,
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK 3: Setbacks - Are they defined?
  // ---------------------------------------------------------------------------

  if (input.zoning.setbacks.front_ft === null &&
      input.zoning.setbacks.side_ft === null &&
      input.zoning.setbacks.rear_ft === null) {
    unknowns.push({
      field: 'zoning.setbacks',
      impact: 'Cannot calculate buildable area accurately',
      research_method: 'Lookup zoning code or contact planning',
      blocks_pass3: false, // Can estimate
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK 4: Lot Coverage
  // ---------------------------------------------------------------------------

  if (input.zoning.max_lot_coverage_pct === null) {
    unknowns.push({
      field: 'zoning.max_lot_coverage_pct',
      impact: 'Cannot determine maximum building footprint',
      research_method: 'Lookup zoning code',
      blocks_pass3: false, // Can estimate
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK 5: Envelope Validity
  // ---------------------------------------------------------------------------

  if (!input.envelope.envelope_valid) {
    unknowns.push({
      field: 'envelope',
      impact: 'Buildability envelope could not be calculated',
      research_method: 'Resolve missing constraints',
      blocks_pass3: true,
    });
  }

  if (input.envelope.net_buildable_acres !== null && input.envelope.net_buildable_acres <= 0) {
    fatalFlaws.push('NO_BUILDABLE_AREA: Net buildable area is zero or negative');
  }

  if (input.envelope.max_buildable_sqft !== null && input.envelope.max_buildable_sqft < 10000) {
    fatalFlaws.push('INSUFFICIENT_SIZE: Max buildable sqft is below viable minimum (10,000 sqft)');
  }

  // ---------------------------------------------------------------------------
  // CHECK 6: Missing Constraints from Envelope
  // ---------------------------------------------------------------------------

  for (const missing of input.envelope.missing_constraints) {
    unknowns.push({
      field: missing,
      impact: 'Constraint used estimate instead of actual value',
      research_method: 'Research jurisdiction requirements',
      blocks_pass3: false,
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK 7: Permitting Complexity
  // ---------------------------------------------------------------------------

  if (input.permitting.estimated_complexity === 'high') {
    // Not fatal but noted
    unknowns.push({
      field: 'permitting.complexity',
      impact: 'High permitting complexity may cause delays',
      research_method: 'Pre-application meeting recommended',
      blocks_pass3: false,
    });
  }

  // ---------------------------------------------------------------------------
  // DETERMINE STATUS
  // ---------------------------------------------------------------------------

  let status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO';

  if (fatalFlaws.length > 0) {
    status = 'NO_GO';
  } else if (unknowns.filter(u => u.blocks_pass3).length > 0) {
    status = 'HOLD_INCOMPLETE';
  } else {
    status = 'ELIGIBLE';
  }

  // ---------------------------------------------------------------------------
  // BUILD SUMMARY
  // ---------------------------------------------------------------------------

  let summary: string;
  if (status === 'ELIGIBLE') {
    summary = `Site is ELIGIBLE for Pass 3 analysis. ${input.envelope.max_buildable_sqft?.toLocaleString() ?? 'Unknown'} sqft buildable on ${input.envelope.net_buildable_acres?.toFixed(2) ?? 'Unknown'} net acres.`;
  } else if (status === 'HOLD_INCOMPLETE') {
    summary = `Site is on HOLD. ${unknowns.filter(u => u.blocks_pass3).length} critical unknown(s) require research before Pass 3.`;
  } else {
    summary = `Site is NO_GO. ${fatalFlaws.length} fatal flaw(s): ${fatalFlaws.join('; ')}`;
  }

  // Determine confidence
  const confidence: 'high' | 'medium' | 'low' =
    unknowns.length === 0 ? 'high' :
    unknowns.length <= 3 ? 'medium' : 'low';

  // ---------------------------------------------------------------------------
  // RETURN RESULT
  // ---------------------------------------------------------------------------

  return {
    spoke_id: 'SS.02.09',
    status, // Verdict status: ELIGIBLE | HOLD_INCOMPLETE | NO_GO
    timestamp,
    notes: summary,
    fatal_flaws: fatalFlaws,
    unknowns,
    manual_research_required: unknowns.length > 0,
    summary,
    confidence,
  };
}
