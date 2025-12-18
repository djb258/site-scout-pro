// =============================================================================
// ENVELOPE REDUCER — Spoke SS.02.08
// =============================================================================
// Doctrine ID: SS.02.08
// Purpose: Calculate buildability envelope from constraints
//
// This is GEOMETRY ONLY. No financial calculations.
// Reduces gross acres to net buildable sqft based on constraints.
// =============================================================================

import type {
  EnvelopeReducerInput,
  EnvelopeReducerResult,
  ZoningConstraintsResult,
  SitePlanConstraintsResult,
  StormwaterConstraintsResult,
  FireAccessConstraintsResult,
} from '../types/constraint_types';

// =============================================================================
// CONSTANTS — Named for clarity
// =============================================================================

/** Square feet per acre */
const SQFT_PER_ACRE = 43560;

/** Efficiency factor for self storage (buildable sqft / gross buildable area) */
const SELF_STORAGE_EFFICIENCY = 0.85;

/** Efficiency factor for RV/boat storage (open lot, higher efficiency) */
const OUTDOOR_STORAGE_EFFICIENCY = 0.90;

/** Default buildable sqft per acre for single-story self storage */
const DEFAULT_SQFT_PER_ACRE_SINGLE_STORY = 25000;

/** Default buildable sqft per acre for multi-story self storage */
const DEFAULT_SQFT_PER_ACRE_MULTI_STORY = 40000;

/** Fire lane width in feet (affects buildable area) */
const FIRE_LANE_WIDTH_FT = 20;

/** Typical parking area per space in sqft */
const PARKING_SQFT_PER_SPACE = 180;

// =============================================================================
// ENVELOPE REDUCER FUNCTION
// =============================================================================

/**
 * Calculate buildability envelope from constraints.
 *
 * DOCTRINE: This is geometry only. No dollars. No timelines.
 */
export async function runEnvelopeReducer(
  input: EnvelopeReducerInput
): Promise<EnvelopeReducerResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.08] Calculating envelope for ${input.gross_acres} acres`);

  const missingConstraints: string[] = [];
  const assumptions: string[] = [];

  // Track reductions
  let setbackAcres = 0;
  let stormwaterAcres = 0;
  let fireLaneAcres = 0;
  let landscapeAcres = 0;
  let parkingAcres = 0;

  const grossSqft = input.gross_acres * SQFT_PER_ACRE;

  // ---------------------------------------------------------------------------
  // STEP 1: Calculate setback reduction
  // ---------------------------------------------------------------------------

  if (input.zoning.setbacks.front_ft !== null &&
      input.zoning.setbacks.side_ft !== null &&
      input.zoning.setbacks.rear_ft !== null) {
    // Simplified setback calculation (assumes rectangular parcel)
    // Real calculation would use actual parcel geometry
    const avgSetback = (
      input.zoning.setbacks.front_ft +
      input.zoning.setbacks.side_ft * 2 +
      input.zoning.setbacks.rear_ft
    ) / 4;

    // Estimate setback area as perimeter × avg setback
    // Simplified: assume 15% of site for setbacks
    setbackAcres = input.gross_acres * 0.15;
    assumptions.push('Setback area estimated at 15% of gross (simplified)');
  } else {
    missingConstraints.push('Setback dimensions incomplete');
    setbackAcres = input.gross_acres * 0.15; // Use default
    assumptions.push('Using default 15% setback reduction');
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Calculate stormwater reduction
  // ---------------------------------------------------------------------------

  if (input.stormwater.estimated_detention_acres !== null) {
    stormwaterAcres = input.stormwater.estimated_detention_acres;
  } else if (input.stormwater.detention_required) {
    // Estimate 5% for detention
    stormwaterAcres = input.gross_acres * 0.05;
    assumptions.push('Detention area estimated at 5% of gross');
  } else {
    missingConstraints.push('Stormwater requirements unknown');
    stormwaterAcres = input.gross_acres * 0.03; // Conservative estimate
    assumptions.push('Using conservative 3% stormwater reduction');
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Calculate fire lane reduction
  // ---------------------------------------------------------------------------

  if (input.fire_access.fire_lane_required) {
    // Fire lane around building perimeter
    // Estimate based on building coverage
    const estimatedBuildingFootprint = input.gross_acres * 0.50 * SQFT_PER_ACRE;
    const perimeterFt = Math.sqrt(estimatedBuildingFootprint) * 4; // Simplified
    const fireLaneSqft = perimeterFt * FIRE_LANE_WIDTH_FT;
    fireLaneAcres = fireLaneSqft / SQFT_PER_ACRE;
    assumptions.push('Fire lane area estimated from building perimeter');
  } else {
    fireLaneAcres = 0;
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Calculate landscape buffer reduction
  // ---------------------------------------------------------------------------

  if (input.site_plan.landscape_pct_required !== null) {
    landscapeAcres = input.gross_acres * (input.site_plan.landscape_pct_required / 100);
  } else if (input.site_plan.landscape_buffer_ft !== null) {
    // Estimate landscape area from buffer
    landscapeAcres = input.gross_acres * 0.10;
    assumptions.push('Landscape area estimated at 10% of gross');
  } else {
    landscapeAcres = input.gross_acres * 0.10; // Default 10%
    assumptions.push('Using default 10% landscape reduction');
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Calculate parking reduction
  // ---------------------------------------------------------------------------

  // For self storage, parking is minimal
  // Estimate based on building size
  if (input.asset_class === 'self_storage') {
    // ~10 spaces for typical self storage
    parkingAcres = (10 * PARKING_SQFT_PER_SPACE) / SQFT_PER_ACRE;
    assumptions.push('Parking estimated at 10 spaces for self storage');
  } else {
    // RV/boat storage has different parking needs
    parkingAcres = (5 * PARKING_SQFT_PER_SPACE) / SQFT_PER_ACRE;
    assumptions.push('Parking estimated at 5 spaces for outdoor storage');
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Calculate net buildable acres
  // ---------------------------------------------------------------------------

  const totalReductionAcres = setbackAcres + stormwaterAcres + fireLaneAcres + landscapeAcres + parkingAcres;
  const netBuildableAcres = Math.max(0, input.gross_acres - totalReductionAcres);

  // ---------------------------------------------------------------------------
  // STEP 7: Calculate sqft per acre ceiling
  // ---------------------------------------------------------------------------

  let sqftPerAcreCeiling: number | null = null;

  if (input.zoning.max_lot_coverage_pct !== null) {
    const coverageFraction = input.zoning.max_lot_coverage_pct / 100;
    const maxStories = input.zoning.max_stories ?? 1;
    const efficiency = input.asset_class === 'self_storage'
      ? SELF_STORAGE_EFFICIENCY
      : OUTDOOR_STORAGE_EFFICIENCY;

    sqftPerAcreCeiling = SQFT_PER_ACRE * coverageFraction * maxStories * efficiency;
  } else {
    // Use default based on asset class
    sqftPerAcreCeiling = input.asset_class === 'self_storage'
      ? DEFAULT_SQFT_PER_ACRE_SINGLE_STORY
      : DEFAULT_SQFT_PER_ACRE_SINGLE_STORY * 0.8; // Open storage is less efficient per acre
    missingConstraints.push('Max lot coverage unknown - using default');
  }

  // ---------------------------------------------------------------------------
  // STEP 8: Calculate max buildable sqft
  // ---------------------------------------------------------------------------

  const maxBuildableSqft = netBuildableAcres * sqftPerAcreCeiling;

  // ---------------------------------------------------------------------------
  // STEP 9: Determine envelope validity
  // ---------------------------------------------------------------------------

  // Envelope is valid if we have enough constraints to calculate
  const criticalConstraintsMissing = missingConstraints.filter(c =>
    c.includes('Setback') || c.includes('lot coverage')
  ).length > 0;

  const envelopeValid = !criticalConstraintsMissing && netBuildableAcres > 0;

  // ---------------------------------------------------------------------------
  // STEP 10: Return result
  // ---------------------------------------------------------------------------

  return {
    spoke_id: 'SS.02.08',
    status: missingConstraints.length === 0 ? 'ok' : 'partial',
    timestamp,
    notes: `Envelope calculated with ${missingConstraints.length} missing constraint(s)`,

    gross_acres: input.gross_acres,
    net_buildable_acres: netBuildableAcres,
    sqft_per_acre_ceiling: sqftPerAcreCeiling,
    max_buildable_sqft: maxBuildableSqft,

    reductions: {
      setback_acres: setbackAcres,
      stormwater_acres: stormwaterAcres,
      fire_lane_acres: fireLaneAcres,
      landscape_acres: landscapeAcres,
      parking_acres: parkingAcres,
      other_acres: 0,
      total_reduction_acres: totalReductionAcres,
    },

    envelope_valid: envelopeValid,
    invalid_reason: envelopeValid ? undefined : 'Critical constraints missing or net buildable is zero',
    missing_constraints: missingConstraints,

    assumptions,
  };
}
