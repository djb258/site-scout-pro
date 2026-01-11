// =============================================================================
// PASS 2 CONSTRAINT TYPES — Spoke Output Definitions
// =============================================================================
// Doctrine ID: SS.02.TYPES
// Purpose: Define types for constraint compiler spokes
//
// DOCTRINE: These types describe PHYSICAL/REGULATORY constraints only.
// NO financial fields. NO revenue. NO cost estimates.
// =============================================================================

/**
 * Base spoke result interface
 */
export interface SpokeResult {
  spoke_id: string;
  status: 'ok' | 'partial' | 'error' | 'stub';
  timestamp: string;
  notes: string;
}

// =============================================================================
// JURISDICTION RESOLVER (SS.02.01)
// =============================================================================

export interface JurisdictionResolverInput {
  zip_code: string;
  state?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
}

export interface JurisdictionInfo {
  jurisdiction_id: string;
  jurisdiction_name: string;
  jurisdiction_type: 'city' | 'county' | 'unincorporated' | 'unknown';
  state: string;
  county: string;
  fips_code?: string;
}

export interface JurisdictionResolverResult extends SpokeResult {
  spoke_id: 'SS.02.01';
  primary_jurisdiction: JurisdictionInfo | null;
  overlapping_jurisdictions: JurisdictionInfo[];
  resolution_method: 'geocode' | 'zip_lookup' | 'manual' | 'unknown';
}

// =============================================================================
// JURISDICTION CARD READER (SS.02.02)
// =============================================================================

export interface JurisdictionCardReaderInput {
  jurisdiction_id: string;
  asset_class: string;
}

export interface JurisdictionCard {
  card_id: string;
  jurisdiction_id: string;
  asset_class: string;
  last_updated: string;
  verified: boolean;

  // Zoning
  typical_zoning_codes: string[];
  storage_by_right: boolean | null;
  conditional_use_typical: boolean | null;

  // Setbacks (typical values)
  typical_setback_front_ft: number | null;
  typical_setback_side_ft: number | null;
  typical_setback_rear_ft: number | null;

  // Coverage
  typical_max_coverage_pct: number | null;
  typical_max_height_ft: number | null;

  // Fire
  fire_code_adopted: string | null;
  fire_lane_required: boolean | null;
  sprinkler_threshold_sqft: number | null;

  // Stormwater
  stormwater_authority: string | null;
  detention_typically_required: boolean | null;

  // Permitting
  typical_permit_timeline_months: number | null;
  permit_difficulty: 'easy' | 'moderate' | 'difficult' | null;

  // Notes
  special_conditions: string[];
  warnings: string[];
}

export interface JurisdictionCardReaderResult extends SpokeResult {
  spoke_id: 'SS.02.02';
  card_found: boolean;
  card: JurisdictionCard | null;
  card_age_days: number | null;
  card_stale: boolean;
}

// =============================================================================
// ZONING CONSTRAINTS (SS.02.03)
// =============================================================================

export interface ZoningConstraintsInput {
  jurisdiction_id: string;
  parcel_id?: string;
  latitude?: number;
  longitude?: number;
  asset_class: string;
}

export interface ZoningConstraintsResult extends SpokeResult {
  spoke_id: 'SS.02.03';

  // Core zoning
  zoning_code: string | null;
  zoning_description: string | null;
  storage_allowed: boolean | null;
  allowed_by_right: boolean | null;
  conditional_use_required: boolean | null;
  variance_required: boolean | null;

  // Dimensional limits
  setbacks: {
    front_ft: number | null;
    side_ft: number | null;
    rear_ft: number | null;
  };
  max_height_ft: number | null;
  max_stories: number | null;
  max_lot_coverage_pct: number | null;
  floor_area_ratio: number | null;

  // Use restrictions
  prohibited_uses: string[];
  special_conditions: string[];

  // Data source
  source: 'regrid' | 'jurisdiction_card' | 'manual' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
}

// =============================================================================
// SITE PLAN CONSTRAINTS (SS.02.04)
// =============================================================================

export interface SitePlanConstraintsInput {
  jurisdiction_id: string;
  asset_class: string;
  gross_acres?: number;
  building_sqft?: number;
}

export interface SitePlanConstraintsResult extends SpokeResult {
  spoke_id: 'SS.02.04';

  // Parking
  min_parking_spaces: number | null;
  parking_ratio: string | null; // e.g., "1 per 2000 sqft"
  ada_spaces_required: number | null;

  // Landscaping
  landscape_buffer_ft: number | null;
  landscape_pct_required: number | null;
  tree_preservation_required: boolean | null;

  // Access
  min_drive_aisle_width_ft: number | null;
  two_way_traffic_required: boolean | null;
  sidewalk_required: boolean | null;

  // Lighting
  lighting_required: boolean | null;
  dark_sky_compliant: boolean | null;
  max_light_height_ft: number | null;

  // Screening
  screening_required: boolean | null;
  fence_max_height_ft: number | null;

  source: 'jurisdiction_card' | 'manual' | 'unknown';
}

// =============================================================================
// STORMWATER CONSTRAINTS (SS.02.05)
// =============================================================================

export interface StormwaterConstraintsInput {
  jurisdiction_id: string;
  gross_acres?: number;
  impervious_pct?: number;
  latitude?: number;
  longitude?: number;
}

export interface StormwaterConstraintsResult extends SpokeResult {
  spoke_id: 'SS.02.05';

  // Requirements
  stormwater_plan_required: boolean | null;
  detention_required: boolean | null;
  retention_required: boolean | null;
  infiltration_allowed: boolean | null;

  // Design standards
  design_storm_year: number | null; // e.g., 25-year storm
  release_rate_cfs_per_acre: number | null;

  // BMP requirements
  bmp_required: boolean | null;
  water_quality_required: boolean | null;

  // Regulatory
  stormwater_authority: string | null;
  permit_required: boolean | null;

  // Impact on buildability
  estimated_detention_acres: number | null;

  source: 'jurisdiction_card' | 'state_rules' | 'manual' | 'unknown';
}

// =============================================================================
// FIRE ACCESS CONSTRAINTS (SS.02.06)
// =============================================================================

export interface FireAccessConstraintsInput {
  jurisdiction_id: string;
  asset_class: string;
  building_sqft?: number;
  stories?: number;
}

export interface FireAccessConstraintsResult extends SpokeResult {
  spoke_id: 'SS.02.06';

  // Fire code
  fire_code_adopted: string | null; // e.g., "IFC 2021"

  // Access requirements
  fire_lane_required: boolean | null;
  fire_lane_width_ft: number | null;
  fire_lane_turning_radius_ft: number | null;
  dead_end_length_max_ft: number | null;

  // Hydrants
  hydrant_required: boolean | null;
  hydrant_spacing_ft: number | null;
  hydrant_distance_max_ft: number | null;

  // Sprinklers
  sprinkler_required: boolean | null;
  sprinkler_threshold_sqft: number | null;

  // Alarms
  fire_alarm_required: boolean | null;

  // Access gates
  knox_box_required: boolean | null;

  source: 'fire_marshal' | 'jurisdiction_card' | 'manual' | 'unknown';
}

// =============================================================================
// PERMITTING CHECKLIST (SS.02.07)
// =============================================================================

export interface PermittingChecklistInput {
  jurisdiction_id: string;
  asset_class: string;
  zoning: ZoningConstraintsResult;
  stormwater: StormwaterConstraintsResult;
  fire_access: FireAccessConstraintsResult;
}

export interface PermitRequirement {
  permit_type: string;
  description: string;
  required: boolean;
  estimated_fee_range?: string;
  typical_timeline_days?: number;
  authority: string;
  notes: string;
}

export interface PermittingChecklistResult extends SpokeResult {
  spoke_id: 'SS.02.07';

  // Required permits
  permits_required: PermitRequirement[];

  // Overall assessment
  total_permits_required: number;
  estimated_complexity: 'low' | 'medium' | 'high' | 'unknown';

  // Special approvals
  public_hearing_required: boolean | null;
  neighbor_notification_required: boolean | null;
  environmental_review_required: boolean | null;

  // Warnings
  potential_delays: string[];
}

// =============================================================================
// ENVELOPE REDUCER (SS.02.08)
// =============================================================================

export interface EnvelopeReducerInput {
  gross_acres: number;
  asset_class: string;
  zoning: ZoningConstraintsResult;
  site_plan: SitePlanConstraintsResult;
  stormwater: StormwaterConstraintsResult;
  fire_access: FireAccessConstraintsResult;
}

export interface EnvelopeReducerResult extends SpokeResult {
  spoke_id: 'SS.02.08';

  // Calculated envelope
  gross_acres: number;
  net_buildable_acres: number | null;
  sqft_per_acre_ceiling: number | null;
  max_buildable_sqft: number | null;

  // Reduction breakdown
  reductions: {
    setback_acres: number | null;
    stormwater_acres: number | null;
    fire_lane_acres: number | null;
    landscape_acres: number | null;
    parking_acres: number | null;
    other_acres: number | null;
    total_reduction_acres: number | null;
  };

  // Validity
  envelope_valid: boolean;
  invalid_reason?: string;
  missing_constraints: string[];

  // Assumptions used
  assumptions: string[];
}

// =============================================================================
// CONSTRAINT VERDICT (SS.02.09)
// =============================================================================

export interface ConstraintVerdictInput {
  jurisdiction: JurisdictionResolverResult;
  card: JurisdictionCardReaderResult;
  zoning: ZoningConstraintsResult;
  site_plan: SitePlanConstraintsResult;
  stormwater: StormwaterConstraintsResult;
  fire_access: FireAccessConstraintsResult;
  permitting: PermittingChecklistResult;
  envelope: EnvelopeReducerResult;
}

export interface ConstraintVerdictResult extends SpokeResult {
  spoke_id: 'SS.02.09';

  // Final status
  status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO';

  // Fatal flaws
  fatal_flaws: string[];

  // Unknowns requiring research
  unknowns: {
    field: string;
    impact: string;
    research_method: string;
    blocks_pass3: boolean;
  }[];

  // Manual research required?
  manual_research_required: boolean;

  // Summary
  summary: string;

  // Confidence
  confidence: 'high' | 'medium' | 'low';
}
