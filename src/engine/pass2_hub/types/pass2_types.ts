/**
 * PASS-2 TYPE DEFINITIONS
 *
 * Complete typed shells for all Pass-2 spoke outputs.
 * Each result includes:
 *   - status: "stub" | "ok" | "error" for tracking implementation state
 *   - Data fields with optional typing (undefined when stubbed)
 *   - notes: Human-readable status/error message
 *
 * All types are JSON-serializable for Lovable.dev/Cloudflare Workers.
 */

import type { OpportunityObject } from '../../shared/opportunity_object';

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// ZONING RESULT
// ============================================================================

export interface ZoningResult {
  status: SpokeStatus;
  zoningCode?: string;
  allowedUses?: string[];
  storageAllowed?: boolean;
  byRight?: boolean;
  conditionalUseRequired?: boolean;
  varianceNeeded?: boolean;
  setbacks?: {
    front_ft?: number;
    side_ft?: number;
    rear_ft?: number;
  };
  heightLimit_ft?: number;
  lotCoverageMax_pct?: number;
  classification?: 'favorable' | 'conditional' | 'challenging' | 'prohibited';
  score?: number;
  notes: string;
}

// ============================================================================
// PERMIT RESULT
// ============================================================================

export interface PermitResult {
  status: SpokeStatus;
  permitRiskLevel?: 'low' | 'medium' | 'high' | 'very_high';
  estimatedTimeline?: string;
  totalFees?: number;
  complexity?: 'low' | 'moderate' | 'high' | 'very_high';
  keyRequirements?: string[];
  criticalPath?: string[];
  portalUrl?: string;
  portalPlatform?: string;
  notes: string;
}

// ============================================================================
// PRICING VERIFICATION RESULT
// ============================================================================

export interface PricingVerificationResult {
  status: SpokeStatus;
  blendedRent?: number;
  climateControl10x10?: number;
  standard10x10?: number;
  outdoor10x20?: number;
  avgPsf?: number;
  marketPosition?: 'premium' | 'competitive' | 'discount';
  rentCurve?: {
    baseRate10x10: number;
    sizeMultipliers: Record<string, number>;
    climatePremiumPct: number;
    projectedAnnualIncreasePct: number;
  };
  dataSources?: string[];
  confidence?: 'high' | 'medium' | 'low';
  notes: string;
}

// ============================================================================
// FUSION DEMAND RESULT
// ============================================================================

export interface FusionDemandResult {
  status: SpokeStatus;
  demandScore?: number;
  supplyGapSqFt?: number;
  households?: number;
  demandSqFt?: number;
  marketTiming?: 'favorable' | 'neutral' | 'unfavorable';
  competitionIntensity?: 'low' | 'moderate' | 'high';
  overallScore?: number;
  industrialContribution?: number;
  housingContribution?: number;
  populationContribution?: number;
  notes: string;
}

// ============================================================================
// COMPETITIVE PRESSURE RESULT
// ============================================================================

export interface CompetitivePressureResult {
  status: SpokeStatus;
  competitorCount5mi?: number;
  competitorCount10mi?: number;
  localSupplySqFt?: number;
  totalSupplySqFt?: number; // NEW: Total supply in market area
  sqftPerCapita?: number;
  saturationIndex?: number;
  marketSaturation?: 'undersupplied' | 'balanced' | 'oversupplied';
  newSupplyPipeline?: number;
  pressureScore?: number;
  notes: string;
}

// ============================================================================
// CIVIL CONSTRAINTS RESULT (NEW)
// ============================================================================

export interface ParkingRequirements {
  minStalls: number;
  adaStalls: number;
  maxSlopePct: number; // ADA requires <2%
  sqftPerStall: number;
  totalParkingArea: number; // sqft
  meetsAdaRequirements: boolean;
}

export interface LotCoverageAnalysis {
  allowedCoveragePct: number;
  requiredCoveragePct: number;
  isFeasible: boolean;
  maxBuildableSqft: number;
  buildingFootprintSqft: number;
  parkingFootprintSqft: number;
  landscapeBufferSqft: number;
  remainingAreaSqft: number;
}

export interface TopographyAnalysis {
  avgSlopePct: number;
  slopeBands: {
    flat_0_2: number; // % of site 0-2% slope
    gentle_2_5: number; // % of site 2-5% slope
    moderate_5_10: number; // % of site 5-10% slope
    steep_10_plus: number; // % of site >10% slope
  };
  buildableAreaReductionPct: number;
  effectiveBuildableAcres: number;
  gradingCostEstimate: number;
  retainingWallsRequired: boolean;
}

export interface StormwaterAnalysis {
  runoffCoefficient: number; // 0.0-1.0 (impervious ratio)
  detentionRequired: boolean;
  detentionBasinAcres: number;
  retentionRequired: boolean;
  infiltrationViability: 'high' | 'medium' | 'low';
  bmpRequired: boolean; // Best Management Practices
  estimatedCost: number;
  regulatoryAuthority?: string;
  notes?: string;
}

export interface ConstructionBonding {
  bondRequired: boolean;
  bondType: 'performance' | 'payment' | 'subdivision' | 'erosion_control' | 'none';
  estimatedAmount: number;
  releaseConditions?: string;
  letterOfCreditAccepted: boolean;
}

export interface CivilConstraintResult {
  status: SpokeStatus;
  // ADA Parking Requirements
  parking: ParkingRequirements;
  // Lot Coverage Feasibility
  lotCoverage: LotCoverageAnalysis;
  // Topography Analysis
  topography: TopographyAnalysis;
  // Stormwater Management
  stormwater: StormwaterAnalysis;
  // Construction Bonding
  bonding: ConstructionBonding;
  // Overall Civil Score (0-100)
  civilScore: number;
  civilRating: 'favorable' | 'moderate' | 'challenging' | 'prohibitive';
  // Cost Impacts
  totalCivilCostAdder: number; // Additional cost beyond standard
  developableAcres: number; // Net developable after constraints
  // Notes
  notes: string;
}

// ============================================================================
// FEASIBILITY RESULT
// ============================================================================

export interface FeasibilityResult {
  status: SpokeStatus;
  landCost?: number;
  constructionCost?: number;
  softCosts?: number;
  totalDevelopmentCost?: number;
  netRentableSqft?: number;
  noi?: number;
  capRate?: number;
  stabilizedValue?: number;
  roi?: number;
  roi5yr?: number;
  cashOnCash?: number;
  dscr?: number;
  isViable?: boolean;
  notes: string;
}

// ============================================================================
// REVERSE FEASIBILITY RESULT
// ============================================================================

export interface ReverseFeasibilityResult {
  status: SpokeStatus;
  requiredRentPsf?: number;
  requiredRent10x10?: number;
  breakEvenOccupancy?: number;
  targetOccupancy?: number;
  stabilizationMonths?: number;
  marketGapPct?: number;
  maxLandPricePerAcre?: number;
  isAchievable?: boolean;
  notes: string;
}

// ============================================================================
// MOMENTUM RESULT (Industrial + Housing)
// ============================================================================

export interface MomentumResult {
  status: SpokeStatus;
  // Industrial
  industrialGrowthRatePct?: number;
  majorEmployers?: string[];
  logisticsScore?: number;
  warehouseVacancyPct?: number;
  newIndustrialSqft?: number;
  industrialMomentumRating?: 'strong' | 'moderate' | 'weak';
  industrialIndex?: number;
  // Housing
  newUnitsPlanned?: number;
  constructionTimeline?: string;
  densityTrend?: 'increasing' | 'stable' | 'decreasing';
  multifamilySharePct?: number;
  demandProjectionSqft?: number;
  timelineAlignment?: 'favorable' | 'neutral' | 'delayed';
  housingGrowth?: number;
  notes: string;
}

// ============================================================================
// VERDICT RESULT
// ============================================================================

export interface VerdictResult {
  status: SpokeStatus;
  recommendation?: 'BUY' | 'BUILD' | 'WALK' | 'EVALUATE' | 'UNSURE';
  decision?: 'PROCEED' | 'EVALUATE' | 'WALK';
  confidence?: number;
  keyFactors?: string[];
  risks?: string[];
  recommendationText?: string;
  nextSteps?: string[];
  notes: string;
}

// ============================================================================
// VAULT PAYLOAD
// ============================================================================

export interface VaultPayload {
  status: SpokeStatus;
  mapped: boolean;
  payload: {
    opportunityId?: string;
    createdAt?: string;
    savedAt?: string;
    identity?: {
      zip: string;
      city: string;
      county: string;
      state: string;
      lat: number;
      lng: number;
    };
    toggles?: Record<string, boolean | string>;
    pass1Summary?: Record<string, unknown>;
    pass2Summary?: Record<string, unknown>;
    verdict?: VerdictResult;
    neonRecord?: unknown; // Full flattened record for Neon insert
  } | null;
  notes: string;
}

// ============================================================================
// PASS-1 TO PASS-2 VALIDATION (for inline use)
// ============================================================================

export interface Pass1ToPass2ValidationMeta {
  validated_at: string;
  pass1_id: string;
  zip: string;
  validation_score: number;
}

export interface Pass1ToPass2ValidationResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  required_fields: string[];
  optional_fields: string[];
  enrichment_status: {
    competitor_enrichment_ready: boolean;
    call_sheet_ready: boolean;
  };
  validation_meta: Pass1ToPass2ValidationMeta;
}

// ============================================================================
// PASS-2 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass2Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  zoning: ZoningResult;
  permits: PermitResult;
  pricing: PricingVerificationResult;
  fusion: FusionDemandResult;
  comp: CompetitivePressureResult;
  civil: CivilConstraintResult; // Civil engineering constraints
  feasibility: FeasibilityResult;
  reverse: ReverseFeasibilityResult;
  momentum: MomentumResult;
  verdict: VerdictResult;
  vaultPayload: VaultPayload;
  error?: string;
  /** Validation result from Pass-1 to Pass-2 gate */
  validation?: Pass1ToPass2ValidationResult;
}

// ============================================================================
// SPOKE INPUT TYPES
// ============================================================================

export interface ZoningInput {
  opportunity: OpportunityObject;
  state: string;
  county: string;
  countyFips?: string;
}

export interface PermitInput {
  opportunity: OpportunityObject;
  state: string;
  county: string;
  countyFips?: string;
}

export interface PricingInput {
  opportunity: OpportunityObject;
  aiCallerPricing?: unknown[];
  competitors?: unknown[];
  state: string;
  countyFips?: string;
}

export interface FusionInput {
  opportunity: OpportunityObject;
  pass1Macro: unknown;
  industrialMomentum: MomentumResult;
  housingPipeline: MomentumResult;
}

export interface CompetitivePressureInput {
  opportunity: OpportunityObject;
  competitors: unknown[];
  macroDemand: unknown;
  state: string;
  countyFips?: string;
}

export interface CivilConstraintInput {
  opportunity: OpportunityObject;
  acreage: number;
  zoning: ZoningResult;
  state: string;
  county: string;
  avgSlopePct?: number; // From site survey or terrain data
  soilType?: 'clay' | 'sand' | 'loam' | 'rock'; // Affects infiltration
}

export interface FeasibilityInput {
  opportunity: OpportunityObject;
  rentBenchmarks: PricingVerificationResult;
  acreage: number;
  landCostPerAcre: number;
  civilConstraints?: CivilConstraintResult; // NEW: Civil cost impacts
}

export interface ReverseFeasibilityInput {
  opportunity: OpportunityObject;
  acreage: number;
  rentBenchmarks: PricingVerificationResult;
  targetCapRate?: number;
  targetRoi?: number;
}

export interface MomentumInput {
  opportunity: OpportunityObject;
  pass1Industrial?: unknown;
  pass1Housing?: unknown;
  state: string;
  county: string;
  countyFips?: string;
}

export interface VerdictInput {
  opportunity: OpportunityObject;
  zoning: ZoningResult;
  permits: PermitResult;
  pricing: PricingVerificationResult;
  fusion: FusionDemandResult;
  comp: CompetitivePressureResult;
  civil: CivilConstraintResult; // NEW: Civil constraints
  feasibility: FeasibilityResult;
  reverse: ReverseFeasibilityResult;
  momentum: MomentumResult;
}

export interface VaultPayloadInput {
  opportunity: OpportunityObject;
  zoning: ZoningResult;
  permits: PermitResult;
  pricing: PricingVerificationResult;
  fusion: FusionDemandResult;
  comp: CompetitivePressureResult;
  civil: CivilConstraintResult; // NEW: Civil constraints
  feasibility: FeasibilityResult;
  reverse: ReverseFeasibilityResult;
  momentum: MomentumResult;
  verdict: VerdictResult;
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubZoning(): ZoningResult {
  return {
    status: 'stub',
    notes: 'Zoning analysis not implemented. TODO: Query jurisdiction_cards table.',
  };
}

export function createStubPermit(): PermitResult {
  return {
    status: 'stub',
    notes: 'Permit analysis not implemented. TODO: Query jurisdiction_cards table.',
  };
}

export function createStubPricing(): PricingVerificationResult {
  return {
    status: 'stub',
    notes: 'Pricing verification not implemented. TODO: Query rate_observations table.',
  };
}

export function createStubFusion(): FusionDemandResult {
  return {
    status: 'stub',
    notes: 'Fusion demand not implemented. TODO: Implement weighted scoring formula.',
  };
}

export function createStubCompetitivePressure(): CompetitivePressureResult {
  return {
    status: 'stub',
    notes: 'Competitive pressure not implemented. TODO: Calculate saturation index.',
  };
}

export function createStubCivilConstraints(): CivilConstraintResult {
  return {
    status: 'stub',
    parking: {
      minStalls: 0,
      adaStalls: 0,
      maxSlopePct: 2,
      sqftPerStall: 180,
      totalParkingArea: 0,
      meetsAdaRequirements: true,
    },
    lotCoverage: {
      allowedCoveragePct: 70,
      requiredCoveragePct: 0,
      isFeasible: true,
      maxBuildableSqft: 0,
      buildingFootprintSqft: 0,
      parkingFootprintSqft: 0,
      landscapeBufferSqft: 0,
      remainingAreaSqft: 0,
    },
    topography: {
      avgSlopePct: 0,
      slopeBands: { flat_0_2: 100, gentle_2_5: 0, moderate_5_10: 0, steep_10_plus: 0 },
      buildableAreaReductionPct: 0,
      effectiveBuildableAcres: 0,
      gradingCostEstimate: 0,
      retainingWallsRequired: false,
    },
    stormwater: {
      runoffCoefficient: 0.85,
      detentionRequired: true,
      detentionBasinAcres: 0,
      retentionRequired: false,
      infiltrationViability: 'medium',
      bmpRequired: false,
      estimatedCost: 0,
    },
    bonding: {
      bondRequired: false,
      bondType: 'none',
      estimatedAmount: 0,
      letterOfCreditAccepted: true,
    },
    civilScore: 50,
    civilRating: 'moderate',
    totalCivilCostAdder: 0,
    developableAcres: 0,
    notes: 'Civil constraints not implemented. TODO: Calculate ADA, lot coverage, topography, stormwater.',
  };
}

export function createStubFeasibility(): FeasibilityResult {
  return {
    status: 'stub',
    notes: 'Feasibility not implemented. TODO: Implement NOI/ROI/DSCR calculations.',
  };
}

export function createStubReverseFeasibility(): ReverseFeasibilityResult {
  return {
    status: 'stub',
    notes: 'Reverse feasibility not implemented. TODO: Calculate required rents.',
  };
}

export function createStubMomentum(): MomentumResult {
  return {
    status: 'stub',
    notes: 'Momentum analysis not implemented. TODO: Fetch industrial + housing data.',
  };
}

export function createStubVerdict(): VerdictResult {
  return {
    status: 'stub',
    notes: 'Verdict not implemented. TODO: Apply weighted scoring to generate decision.',
  };
}

export function createStubVaultPayload(): VaultPayload {
  return {
    status: 'stub',
    mapped: false,
    payload: null,
    notes: 'Vault payload not built. TODO: Map all results to vault schema.',
  };
}

export function createErrorResult<T extends { status: SpokeStatus; notes: string }>(
  error: Error | string,
  factory: () => T
): T {
  const result = factory();
  result.status = 'error';
  result.notes = `Error: ${error instanceof Error ? error.message : error}`;
  return result;
}
