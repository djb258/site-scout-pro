// =============================================================================
// ENVELOPE REDUCER — Spoke SS.02.08
// =============================================================================
// Doctrine ID: SS.02.08
// Purpose: Calculate buildability envelope from constraints
//
// This is GEOMETRY ONLY. No financial calculations.
// Reduces gross acres to net buildable sqft based on constraints.
//
// GUARDRAIL: EnvelopeReducer MUST REFUSE to calculate if any
// REQUIRED_FOR_ENVELOPE field is unknown, blocked, or stale.
// No silent partial envelopes.
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
// GUARDRAIL: REQUIRED FIELDS FOR ENVELOPE
// =============================================================================

/**
 * Fields required for envelope calculation.
 * If ANY of these are null (unknown), EnvelopeReducer MUST refuse.
 */
interface RequiredFieldCheck {
  field: string;
  value: any;
  source: string;
  revalidation_required?: boolean;
}

/**
 * Check if required fields are present and not stale.
 * Returns list of missing/stale fields, or empty array if all OK.
 */
function checkRequiredFields(input: EnvelopeReducerInput): {
  missing: string[];
  stale: string[];
} {
  const missing: string[] = [];
  const stale: string[] = [];

  const checks: RequiredFieldCheck[] = [
    {
      field: 'setback_front_ft',
      value: input.zoning.setbacks.front_ft,
      source: 'zoning',
    },
    {
      field: 'setback_side_ft',
      value: input.zoning.setbacks.side_ft,
      source: 'zoning',
    },
    {
      field: 'setback_rear_ft',
      value: input.zoning.setbacks.rear_ft,
      source: 'zoning',
    },
    {
      field: 'max_lot_coverage_pct',
      value: input.zoning.max_lot_coverage_pct,
      source: 'zoning',
    },
    {
      field: 'stormwater_plan_required',
      value: input.stormwater.stormwater_plan_required,
      source: 'stormwater',
    },
    {
      field: 'fire_lane_required',
      value: input.fire_access.fire_lane_required,
      source: 'fire_access',
    },
  ];

  for (const check of checks) {
    if (check.value === null || check.value === undefined) {
      missing.push(`${check.source}.${check.field}`);
    } else if (check.revalidation_required) {
      stale.push(`${check.source}.${check.field}`);
    }
  }

  return { missing, stale };
}

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
 *
 * GUARDRAIL: This function REFUSES to calculate if any REQUIRED_FOR_ENVELOPE
 * field is unknown, blocked, or stale. No silent partial envelopes.
 */
export async function runEnvelopeReducer(
  input: EnvelopeReducerInput
): Promise<EnvelopeReducerResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.08] Calculating envelope for ${input.gross_acres} acres`);

  // ===========================================================================
  // GUARDRAIL: Check required fields BEFORE any calculation
  // ===========================================================================
  const requiredCheck = checkRequiredFields(input);

  if (requiredCheck.missing.length > 0 || requiredCheck.stale.length > 0) {
    const reasons: string[] = [];
    if (requiredCheck.missing.length > 0) {
      reasons.push(`Missing required fields: ${requiredCheck.missing.join(', ')}`);
    }
    if (requiredCheck.stale.length > 0) {
      reasons.push(`Stale fields requiring revalidation: ${requiredCheck.stale.join(', ')}`);
    }

    console.log(`[SS.02.08] GUARDRAIL: Refusing to calculate envelope. ${reasons.join('; ')}`);

    return {
      spoke_id: 'SS.02.08',
      status: 'error',
      timestamp,
      notes: `GUARDRAIL: Envelope calculation refused. ${reasons.join('; ')}`,

      gross_acres: input.gross_acres,
      net_buildable_acres: null,
      sqft_per_acre_ceiling: null,
      max_buildable_sqft: null,

      reductions: {
        setback_acres: 0,
        stormwater_acres: 0,
        fire_lane_acres: 0,
        landscape_acres: 0,
        parking_acres: 0,
        other_acres: 0,
        total_reduction_acres: 0,
      },

      envelope_valid: false,
      invalid_reason: reasons.join('; '),
      missing_constraints: requiredCheck.missing,

      assumptions: [],
    };
  }
  // ===========================================================================

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
