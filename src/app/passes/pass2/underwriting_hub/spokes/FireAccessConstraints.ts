// =============================================================================
// FIRE ACCESS CONSTRAINTS — Spoke SS.02.06
// =============================================================================
// Doctrine ID: SS.02.06
// Purpose: Compile fire access and suppression requirements
//
// Fire lanes and hydrant spacing impact buildable area.
// NO financial logic. Only physical/regulatory constraints.
// =============================================================================

import type {
  FireAccessConstraintsInput,
  FireAccessConstraintsResult,
  JurisdictionCard,
} from '../types/constraint_types';

/**
 * Compile fire access constraints.
 *
 * TODO: Implement actual lookup from:
 * - Fire marshal requirements
 * - Adopted fire code (IFC version)
 * - Jurisdiction cards
 */
export async function runFireAccessConstraints(
  input: FireAccessConstraintsInput,
  jurisdictionCard?: JurisdictionCard | null
): Promise<FireAccessConstraintsResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.06] Compiling fire access constraints for jurisdiction: ${input.jurisdiction_id}`);

  // Determine sprinkler requirement based on building size
  const sprinklerThreshold = jurisdictionCard?.sprinkler_threshold_sqft ?? 5000;
  const sprinklerRequired = input.building_sqft
    ? input.building_sqft > sprinklerThreshold
    : null;

  // If we have a jurisdiction card, use it
  if (jurisdictionCard) {
    return {
      spoke_id: 'SS.02.06',
      status: 'partial',
      timestamp,
      notes: `Fire access from jurisdiction card. Code: ${jurisdictionCard.fire_code_adopted || 'Unknown'}`,

      fire_code_adopted: jurisdictionCard.fire_code_adopted,

      fire_lane_required: jurisdictionCard.fire_lane_required,
      fire_lane_width_ft: 20, // IFC minimum
      fire_lane_turning_radius_ft: 25, // IFC typical
      dead_end_length_max_ft: 150, // IFC typical

      hydrant_required: true,
      hydrant_spacing_ft: 400, // IFC typical
      hydrant_distance_max_ft: 400,

      sprinkler_required: sprinklerRequired,
      sprinkler_threshold_sqft: sprinklerThreshold,

      fire_alarm_required: true,

      knox_box_required: true,

      source: 'jurisdiction_card',
    };
  }

  // STUB: Return IFC defaults
  return {
    spoke_id: 'SS.02.06',
    status: 'stub',
    timestamp,
    notes: 'Fire access using IFC defaults. Verify with fire marshal.',

    fire_code_adopted: 'IFC 2021 (assumed)',

    fire_lane_required: true, // Required for buildings over certain size
    fire_lane_width_ft: 20, // IFC minimum
    fire_lane_turning_radius_ft: 25,
    dead_end_length_max_ft: 150,

    hydrant_required: true,
    hydrant_spacing_ft: 400,
    hydrant_distance_max_ft: 400,

    sprinkler_required: sprinklerRequired,
    sprinkler_threshold_sqft: 5000, // Common threshold

    fire_alarm_required: true,

    knox_box_required: true,

    source: 'unknown',
  };
}
