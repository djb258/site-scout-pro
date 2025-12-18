// =============================================================================
// ZONING CONSTRAINTS — Spoke SS.02.03
// =============================================================================
// Doctrine ID: SS.02.03
// Purpose: Compile zoning constraints for a site/jurisdiction
//
// Data sources:
// - Regrid API (parcel-level zoning)
// - Jurisdiction cards (typical constraints)
// - Manual research
//
// NO financial logic. Only physical/regulatory constraints.
// =============================================================================

import type {
  ZoningConstraintsInput,
  ZoningConstraintsResult,
  JurisdictionCard,
} from '../types/constraint_types';

/**
 * Compile zoning constraints for a site.
 *
 * TODO: Implement actual zoning lookup via:
 * - Regrid API (if parcel_id provided)
 * - Jurisdiction card fallback
 */
export async function runZoningConstraints(
  input: ZoningConstraintsInput,
  jurisdictionCard?: JurisdictionCard | null
): Promise<ZoningConstraintsResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.03] Compiling zoning constraints for jurisdiction: ${input.jurisdiction_id}`);

  // If we have a jurisdiction card, use it as fallback data
  if (jurisdictionCard) {
    return {
      spoke_id: 'SS.02.03',
      status: 'partial',
      timestamp,
      notes: 'Zoning from jurisdiction card (typical values, not parcel-specific)',

      zoning_code: jurisdictionCard.typical_zoning_codes[0] ?? null,
      zoning_description: null,
      storage_allowed: jurisdictionCard.storage_by_right ?? null,
      allowed_by_right: jurisdictionCard.storage_by_right,
      conditional_use_required: jurisdictionCard.conditional_use_typical,
      variance_required: null,

      setbacks: {
        front_ft: jurisdictionCard.typical_setback_front_ft,
        side_ft: jurisdictionCard.typical_setback_side_ft,
        rear_ft: jurisdictionCard.typical_setback_rear_ft,
      },
      max_height_ft: jurisdictionCard.typical_max_height_ft,
      max_stories: null,
      max_lot_coverage_pct: jurisdictionCard.typical_max_coverage_pct,
      floor_area_ratio: null,

      prohibited_uses: [],
      special_conditions: jurisdictionCard.special_conditions,

      source: 'jurisdiction_card',
      confidence: 'low',
    };
  }

  // STUB: No data available
  return {
    spoke_id: 'SS.02.03',
    status: 'stub',
    timestamp,
    notes: 'Zoning constraints not available. Requires Regrid API or manual research.',

    zoning_code: null,
    zoning_description: null,
    storage_allowed: null,
    allowed_by_right: null,
    conditional_use_required: null,
    variance_required: null,

    setbacks: {
      front_ft: null,
      side_ft: null,
      rear_ft: null,
    },
    max_height_ft: null,
    max_stories: null,
    max_lot_coverage_pct: null,
    floor_area_ratio: null,

    prohibited_uses: [],
    special_conditions: [],

    source: 'unknown',
    confidence: 'low',
  };
}
