// =============================================================================
// STORMWATER CONSTRAINTS — Spoke SS.02.05
// =============================================================================
// Doctrine ID: SS.02.05
// Purpose: Compile stormwater management requirements
//
// Data impacts buildability via detention/retention area requirements.
// NO financial logic. Only physical/regulatory constraints.
// =============================================================================

import type {
  StormwaterConstraintsInput,
  StormwaterConstraintsResult,
  JurisdictionCard,
} from '../types/constraint_types';

/**
 * Compile stormwater constraints.
 *
 * TODO: Implement actual lookup from:
 * - State stormwater regulations
 * - County/city ordinances
 * - Jurisdiction cards
 */
export async function runStormwaterConstraints(
  input: StormwaterConstraintsInput,
  jurisdictionCard?: JurisdictionCard | null
): Promise<StormwaterConstraintsResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.05] Compiling stormwater constraints for jurisdiction: ${input.jurisdiction_id}`);

  // Estimate detention acres based on impervious coverage
  // Rule of thumb: ~3-5% of gross site for detention
  let estimatedDetentionAcres: number | null = null;
  if (input.gross_acres) {
    const imperviousPct = input.impervious_pct ?? 0.70; // Assume 70% impervious
    estimatedDetentionAcres = input.gross_acres * imperviousPct * 0.05; // 5% of impervious
  }

  // If we have a jurisdiction card, use it
  if (jurisdictionCard) {
    return {
      spoke_id: 'SS.02.05',
      status: 'partial',
      timestamp,
      notes: 'Stormwater requirements from jurisdiction card',

      stormwater_plan_required: true, // Almost always required
      detention_required: jurisdictionCard.detention_typically_required,
      retention_required: null,
      infiltration_allowed: null,

      design_storm_year: 25, // Common standard
      release_rate_cfs_per_acre: null,

      bmp_required: true,
      water_quality_required: true,

      stormwater_authority: jurisdictionCard.stormwater_authority,
      permit_required: true,

      estimated_detention_acres: estimatedDetentionAcres,

      source: 'jurisdiction_card',
    };
  }

  // STUB: Return common requirements
  return {
    spoke_id: 'SS.02.05',
    status: 'stub',
    timestamp,
    notes: 'Stormwater constraints using common defaults. Verify with local authority.',

    stormwater_plan_required: true, // Almost always required for commercial
    detention_required: true, // Common requirement
    retention_required: null,
    infiltration_allowed: null,

    design_storm_year: 25,
    release_rate_cfs_per_acre: null,

    bmp_required: null,
    water_quality_required: null,

    stormwater_authority: null,
    permit_required: true,

    estimated_detention_acres: estimatedDetentionAcres,

    source: 'unknown',
  };
}
