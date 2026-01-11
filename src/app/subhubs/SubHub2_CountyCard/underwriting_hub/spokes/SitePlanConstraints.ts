// =============================================================================
// SITE PLAN CONSTRAINTS — Spoke SS.02.04
// =============================================================================
// Doctrine ID: SS.02.04
// Purpose: Compile site plan requirements (parking, landscaping, access)
//
// NO financial logic. Only physical/regulatory constraints.
// =============================================================================

import type {
  SitePlanConstraintsInput,
  SitePlanConstraintsResult,
  JurisdictionCard,
} from '../types/constraint_types';

/**
 * Compile site plan constraints.
 *
 * TODO: Implement actual lookup from:
 * - Jurisdiction ordinances
 * - Jurisdiction cards
 */
export async function runSitePlanConstraints(
  input: SitePlanConstraintsInput,
  jurisdictionCard?: JurisdictionCard | null
): Promise<SitePlanConstraintsResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.04] Compiling site plan constraints for jurisdiction: ${input.jurisdiction_id}`);

  // Calculate parking based on asset class
  let parkingRatio = '1 per 3000 sqft'; // Default for self storage
  if (input.asset_class === 'rv_storage') {
    parkingRatio = '1 per 50 spaces';
  } else if (input.asset_class === 'boat_storage') {
    parkingRatio = '1 per 50 spaces';
  }

  // If we have a jurisdiction card, use it
  if (jurisdictionCard) {
    return {
      spoke_id: 'SS.02.04',
      status: 'partial',
      timestamp,
      notes: 'Site plan constraints from jurisdiction card (typical values)',

      min_parking_spaces: null, // Depends on building size
      parking_ratio: parkingRatio,
      ada_spaces_required: null,

      landscape_buffer_ft: 10, // Common default
      landscape_pct_required: 10, // Common default
      tree_preservation_required: null,

      min_drive_aisle_width_ft: 24, // Common minimum
      two_way_traffic_required: true,
      sidewalk_required: null,

      lighting_required: true,
      dark_sky_compliant: null,
      max_light_height_ft: 25,

      screening_required: true, // Usually required for industrial uses
      fence_max_height_ft: 8,

      source: 'jurisdiction_card',
    };
  }

  // STUB: Return common defaults
  return {
    spoke_id: 'SS.02.04',
    status: 'stub',
    timestamp,
    notes: 'Site plan constraints using industry defaults. Verify with jurisdiction.',

    min_parking_spaces: null,
    parking_ratio: parkingRatio,
    ada_spaces_required: null,

    landscape_buffer_ft: null,
    landscape_pct_required: null,
    tree_preservation_required: null,

    min_drive_aisle_width_ft: 24,
    two_way_traffic_required: true,
    sidewalk_required: null,

    lighting_required: null,
    dark_sky_compliant: null,
    max_light_height_ft: null,

    screening_required: null,
    fence_max_height_ft: null,

    source: 'unknown',
  };
}
