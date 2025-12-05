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
  sqftPerCapita?: number;
  saturationIndex?: number;
  marketSaturation?: 'undersupplied' | 'balanced' | 'oversupplied';
  newSupplyPipeline?: number;
  pressureScore?: number;
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
  } | null;
  notes: string;
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
  feasibility: FeasibilityResult;
  reverse: ReverseFeasibilityResult;
  momentum: MomentumResult;
  verdict: VerdictResult;
  vaultPayload: VaultPayload;
  error?: string;
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

export interface FeasibilityInput {
  opportunity: OpportunityObject;
  rentBenchmarks: PricingVerificationResult;
  acreage: number;
  landCostPerAcre: number;
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
