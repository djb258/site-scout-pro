/**
 * OPPORTUNITY OBJECT - Unified Data Transfer Object
 *
 * The central data structure that flows through both Pass 1 and Pass 2 hubs.
 * Contains all intelligence gathered during the screening process.
 */

// ============================================================================
// IDENTITY BLOCK
// ============================================================================

export interface IdentityBlock {
  zip: string;
  city: string;
  county: string;
  state: string;
  state_id: string;
  lat: number;
  lng: number;
  county_fips?: string;
}

// ============================================================================
// ANALYSIS FLAGS / TOGGLES
// ============================================================================

export interface AnalysisToggles {
  urban_exclude: boolean;
  multifamily_priority: boolean;
  recreation_load: boolean;
  industrial_momentum: boolean;
  analysis_mode: 'build' | 'buy' | 'compare';
}

// ============================================================================
// PASS 1 MACRO RESULTS
// ============================================================================

export interface ZipMetadata {
  zip: string;
  city: string;
  county: string;
  state_id: string;
  state_name: string;
  lat: number;
  lng: number;
  population: number;
  density: number;
  income_household_median: number;
  home_value: number;
  home_ownership: number;
  rent_median: number;
  age_median: number;
  education_college_or_above?: number;
  unemployment_rate?: number;
}

export interface RadiusCounty {
  county: string;
  state: string;
  population: number;
  distance_miles?: number;
}

export interface Competitor {
  name: string;
  address?: string;
  distance_miles: number;
  estimated_sqft: number;
  climate_controlled?: boolean;
  rating?: number;
  review_count?: number;
  // Enrichment fields (added by competitor_enrichment spoke)
  grade?: 'A' | 'B' | 'C'; // A=National REIT, B=Regional operator, C=Mom & Pop
  facility_type?: 'traditional' | 'climate_only' | 'rv_boat' | 'mixed' | 'portable';
  brand?: string;
  is_reit?: boolean;
  unit_count_estimate?: number;
  occupancy_estimate?: number;
  year_built?: number;
  has_rv_boat?: boolean;
  has_wine_storage?: boolean;
  has_vehicle_storage?: boolean;
  enrichment_confidence?: 'high' | 'medium' | 'low';
}

export interface HousingSignals {
  median_home_value: number;
  home_ownership_rate: number;
  rent_median: number;
  growth_indicator: 'high' | 'moderate' | 'low';
  multifamily_units?: number;
  new_construction_permits?: number;
}

export interface Anchor {
  type: 'retail' | 'employer' | 'university' | 'military' | 'distribution';
  name: string;
  distance_miles: number;
  employee_count?: number;
  student_count?: number;
}

export interface RvLakeSignals {
  recreation_load: boolean;
  rv_potential: 'high' | 'moderate' | 'low';
  lake_proximity: boolean;
  campground_nearby: boolean;
  water_body_name?: string;
  water_body_acres?: number;
}

export interface IndustrialSignals {
  industrial_momentum: boolean;
  distribution_centers_nearby: number;
  manufacturing_presence: 'high' | 'moderate' | 'low';
  logistics_corridors?: string[];
}

export interface MacroDemandResult {
  population: number;
  demand_sqft: number; // population × 6 sqft
  household_count: number;
  demand_per_household: number;
}

export interface MacroSupplyResult {
  competitor_count: number;
  total_supply_sqft: number;
  avg_distance_miles: number;
  density_score: number; // 0-100, lower = less competition = better
}

export interface HotspotScore {
  overall_score: number;
  population_factor: number;
  competition_factor: number;
  industrial_factor: number;
  multifamily_factor: number;
  recreation_factor: number;
  tier: 'A' | 'B' | 'C' | 'D';
}

export interface CompetitorEnrichmentSummary {
  total_competitors: number;
  grade_a_count: number;
  grade_b_count: number;
  grade_c_count: number;
  reit_presence: boolean;
  avg_estimated_sqft: number;
  total_estimated_sqft: number;
  dominant_type: 'traditional' | 'climate_only' | 'rv_boat' | 'mixed' | 'portable';
  enrichment_complete: boolean;
  enrichment_timestamp?: string;
}

export interface Pass1ValidationResult {
  is_valid: boolean;
  validation_timestamp: string;
  missing_fields: string[];
  warnings: string[];
  pass2_ready: boolean;
  validation_score: number; // 0-100 completeness score
  blockers: string[]; // Critical issues that prevent Pass-2
}

export interface Pass1MacroResults {
  zip_metadata: ZipMetadata;
  radius_counties: RadiusCounty[];
  competitors: Competitor[];
  housing_signals: HousingSignals;
  anchors: Anchor[];
  rv_lake_signals: RvLakeSignals;
  industrial_signals: IndustrialSignals;
  macro_demand: MacroDemandResult;
  macro_supply: MacroSupplyResult;
  hotspot_score: HotspotScore;
  // NEW: Enrichment summary
  competitor_enrichment?: CompetitorEnrichmentSummary;
  // NEW: Validation gate result
  validation?: Pass1ValidationResult;
}

// ============================================================================
// LOCAL SCAN RESULTS (Optional - triggered by radius slider)
// ============================================================================

export interface LocalScanConfig {
  radius_miles: number; // 5-30 miles slider
  include_pricing: boolean;
  generate_call_sheet: boolean;
}

export interface LocalCompetitor extends Competitor {
  phone?: string;
  website?: string;
  pricing_verified: boolean;
  last_pricing_date?: string;
  rates?: {
    '5x5'?: number;
    '5x10'?: number;
    '10x10'?: number;
    '10x15'?: number;
    '10x20'?: number;
    '10x30'?: number;
  };
}

export interface CallSheetEntry {
  facility_name: string;
  phone: string;
  address: string;
  distance_miles: number;
  notes: string;
  pricing_needed: boolean;
  call_status: 'pending' | 'completed' | 'no_answer' | 'skipped';
}

export interface LocalScanResults {
  config: LocalScanConfig;
  local_competitors: LocalCompetitor[];
  call_sheet: CallSheetEntry[];
  pricing_readiness: {
    total_facilities: number;
    pricing_verified: number;
    pricing_needed: number;
    readiness_pct: number;
  };
}

// ============================================================================
// AI CALLER PRICING BLOCK
// ============================================================================

export interface AiCallerPricing {
  facility_id: string;
  facility_name: string;
  call_date: string;
  call_duration_seconds?: number;
  call_recording_url?: string;
  rates_collected: {
    unit_size: string;
    sqft: number;
    climate_control: boolean;
    advertised_rate: number;
    promo_rate?: number;
    promo_details?: string;
  }[];
  availability: {
    unit_size: string;
    available: boolean;
    units_available?: number;
    waitlist?: boolean;
  }[];
  admin_fee?: number;
  insurance_required?: boolean;
  confidence_level: 'high' | 'medium' | 'low';
}

// ============================================================================
// PASS 1 RECOMMENDATION
// ============================================================================

export interface Pass1Recommendation {
  viability_score: number; // 0-100
  tier: 'A' | 'B' | 'C' | 'D';
  recommendation: string;
  key_factors: string[];
  risk_factors: string[];
  proceed_to_pass2: boolean;
}

// ============================================================================
// PASS 2 RESULTS
// ============================================================================

export interface ZoningIntel {
  primary_zone: string;
  storage_allowed: boolean;
  by_right: boolean;
  conditional_use_required: boolean;
  variance_needed: boolean;
  setback_requirements?: string;
  height_limit?: string;
  lot_coverage_max?: string;
  parking_requirements?: string;
  landscape_requirements?: string;
  classification: 'favorable' | 'conditional' | 'challenging' | 'prohibited';
  score: number;
}

export interface PermitIntel {
  portal_url?: string;
  portal_platform?: string;
  estimated_timeline: string;
  total_fees: number;
  complexity: 'low' | 'moderate' | 'high' | 'very_high';
  key_requirements: string[];
  critical_path: string[];
}

export interface RentBenchmarks {
  climate_control_10x10: number;
  standard_10x10: number;
  outdoor_10x20: number;
  climate_control_10x20?: number;
  market_position: 'premium' | 'competitive' | 'discount';
  avg_psf: number;
  data_sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface RentCurveModel {
  base_rate_10x10: number;
  size_multipliers: Record<string, number>;
  climate_premium_pct: number;
  seasonal_adjustment?: {
    peak_months: string[];
    peak_premium_pct: number;
  };
  projected_annual_increase_pct: number;
}

export interface FusionDemandResult {
  demand_score: number;
  supply_gap_sqft: number;
  market_timing: 'favorable' | 'neutral' | 'unfavorable';
  competition_intensity: 'low' | 'moderate' | 'high';
  overall_score: number;
  industrial_contribution: number;
  housing_contribution: number;
  population_contribution: number;
}

export interface CompetitivePressureAnalysis {
  competitor_count_5mi: number;
  competitor_count_10mi: number;
  sqft_per_capita: number;
  market_saturation: 'undersupplied' | 'balanced' | 'oversupplied';
  new_supply_pipeline: number;
  pressure_score: number; // 0-100, lower = less pressure = better
}

export interface FeasibilityResult {
  land_cost: number;
  construction_cost: number;
  soft_costs: number;
  total_development_cost: number;
  net_rentable_sqft: number;
  projected_noi: number;
  cap_rate: number;
  stabilized_value: number;
  roi_5yr: number;
  cash_on_cash: number;
  dscr: number;
  is_viable: boolean;
}

export interface ReverseFeasibilityResult {
  required_rent_psf: number;
  break_even_occupancy: number;
  target_occupancy: number;
  stabilization_months: number;
  market_gap_pct: number;
  is_achievable: boolean;
  max_land_price_per_acre: number;
}

export interface IndustrialMomentum {
  growth_rate_pct: number;
  major_employers: string[];
  logistics_score: number;
  warehouse_vacancy_pct: number;
  new_industrial_sqft: number;
  momentum_rating: 'strong' | 'moderate' | 'weak';
}

export interface HousingPipeline {
  new_units_planned: number;
  construction_timeline: string;
  density_trend: 'increasing' | 'stable' | 'decreasing';
  multifamily_share_pct: number;
  demand_projection_sqft: number;
  timeline_alignment: 'favorable' | 'neutral' | 'delayed';
}

export interface Pass2Results {
  zoning_intel: ZoningIntel;
  permit_intel: PermitIntel;
  rent_benchmarks: RentBenchmarks;
  rent_curve_model?: RentCurveModel;
  fusion_demand: FusionDemandResult;
  competitive_pressure: CompetitivePressureAnalysis;
  feasibility: FeasibilityResult;
  reverse_feasibility: ReverseFeasibilityResult;
  industrial_momentum: IndustrialMomentum;
  housing_pipeline: HousingPipeline;
}

// ============================================================================
// FINAL VERDICT
// ============================================================================

export interface FinalVerdict {
  decision: 'PROCEED' | 'EVALUATE' | 'WALK';
  confidence: number; // 0-1
  key_factors: string[];
  risks: string[];
  recommendation: string;
  next_steps?: string[];
}

// ============================================================================
// VAULT PAYLOAD
// ============================================================================

export interface VaultPayload {
  opportunity_id: string;
  created_at: string;
  saved_at: string;
  identity: IdentityBlock;
  toggles: AnalysisToggles;
  pass1_results: Pass1MacroResults;
  local_scan_results?: LocalScanResults;
  ai_caller_pricing?: AiCallerPricing[];
  pass1_recommendation: Pass1Recommendation;
  pass2_results: Pass2Results;
  final_verdict: FinalVerdict;
  notes?: string;
}

// ============================================================================
// THE OPPORTUNITY OBJECT - Complete Transfer Object
// ============================================================================

export interface OpportunityObject {
  // Identity
  id: string;
  identity: IdentityBlock;
  toggles: AnalysisToggles;

  // Pass 1 Macro Results
  pass1_macro: Pass1MacroResults;

  // Local Scan (optional, triggered by radius slider)
  local_scan?: LocalScanResults;

  // AI Caller Pricing (collected during local scan)
  ai_caller_pricing?: AiCallerPricing[];

  // Pass 1 Recommendation
  pass1_recommendation: Pass1Recommendation;

  // Metadata for Pass 2
  pass2_ready: boolean;
  pass2_prerequisites: {
    has_pricing_data: boolean;
    has_competitor_list: boolean;
    has_zoning_lookup: boolean;
  };

  // Pass 2 Results (populated after Pass 2 runs)
  pass2_results?: Pass2Results;

  // Final Verdict (populated after Pass 2)
  final_verdict?: FinalVerdict;

  // Timestamps
  created_at: string;
  pass1_completed_at?: string;
  local_scan_completed_at?: string;
  pass2_completed_at?: string;
  saved_to_vault_at?: string;

  // Status
  status: 'pending' | 'pass1_complete' | 'local_scan_complete' | 'pass2_complete' | 'saved';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createEmptyOpportunityObject(zip: string, toggles: AnalysisToggles): OpportunityObject {
  return {
    id: crypto.randomUUID(),
    identity: {
      zip,
      city: '',
      county: '',
      state: '',
      state_id: '',
      lat: 0,
      lng: 0,
    },
    toggles,
    pass1_macro: {
      zip_metadata: {} as ZipMetadata,
      radius_counties: [],
      competitors: [],
      housing_signals: {} as HousingSignals,
      anchors: [],
      rv_lake_signals: {} as RvLakeSignals,
      industrial_signals: {} as IndustrialSignals,
      macro_demand: {} as MacroDemandResult,
      macro_supply: {} as MacroSupplyResult,
      hotspot_score: {} as HotspotScore,
    },
    pass1_recommendation: {
      viability_score: 0,
      tier: 'D',
      recommendation: '',
      key_factors: [],
      risk_factors: [],
      proceed_to_pass2: false,
    },
    pass2_ready: false,
    pass2_prerequisites: {
      has_pricing_data: false,
      has_competitor_list: false,
      has_zoning_lookup: false,
    },
    created_at: new Date().toISOString(),
    status: 'pending',
  };
}
