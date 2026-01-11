/**
 * PASS-1 TYPE DEFINITIONS
 *
 * Type definitions for Pass-1 Structure Hub (SS.01.00)
 * Market reconnaissance and hotspot identification.
 *
 * All types are JSON-serializable for edge/cloud function execution.
 */

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// ZIP HYDRATION RESULT (SS.01.01)
// ============================================================================

export interface ZipHydrationResult {
  status: SpokeStatus;
  zipCode?: string;
  city?: string;
  county?: string;
  countyFips?: string;
  state?: string;
  lat?: number;
  lng?: number;
  population?: number;
  medianHouseholdIncome?: number;
  medianAge?: number;
  housingUnits?: number;
  ownerOccupiedPct?: number;
  renterOccupiedPct?: number;
  landAreaSqMi?: number;
  populationDensity?: number;           // per sq mile
  notes: string;
}

// ============================================================================
// RADIUS BUILDER RESULT (SS.01.02)
// ============================================================================

export interface CountyInRadius {
  countyFips: string;
  countyName: string;
  state: string;
  distanceMiles: number;
  population: number;
}

export interface RadiusBuilderResult {
  status: SpokeStatus;
  centerZip?: string;
  radiusMiles?: number;
  countiesInRadius?: CountyInRadius[];
  totalPopulation?: number;
  totalZipCodes?: number;
  notes: string;
}

// ============================================================================
// MACRO DEMAND RESULT (SS.01.03)
// ============================================================================

export interface MacroDemandResult {
  status: SpokeStatus;
  baseDemandSqft?: number;              // population x 6 sqft
  adjustedDemandSqft?: number;
  populationGrowthRate?: number;        // % YoY
  employmentGrowthRate?: number;        // % YoY
  householdFormationRate?: number;
  incomeAdjustmentFactor?: number;      // 0.8 - 1.2
  demandScore?: number;                 // 0-100
  notes: string;
}

// ============================================================================
// MACRO SUPPLY RESULT (SS.01.04)
// ============================================================================

export interface MacroSupplyResult {
  status: SpokeStatus;
  totalSupplySqft?: number;
  supplySqftPerCapita?: number;
  competitorCount?: number;
  avgFacilitySize?: number;
  marketSaturation?: 'undersupplied' | 'balanced' | 'oversupplied';
  supplyGrowthRate?: number;            // % YoY new supply
  supplyScore?: number;                 // 0-100 (higher = less supply = better)
  notes: string;
}

// ============================================================================
// COMPETITOR REGISTRY RESULT (SS.01.05)
// ============================================================================

export interface Competitor {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  brand: 'national' | 'regional' | 'local';
  estimatedSqft?: number;
  rating?: number;
  reviewCount?: number;
  amenities?: string[];
  phone?: string;
  website?: string;
}

export interface CompetitorRegistryResult {
  status: SpokeStatus;
  competitors?: Competitor[];
  totalCount?: number;
  nationalBrandCount?: number;
  regionalBrandCount?: number;
  localBrandCount?: number;
  nearestCompetitorMiles?: number;
  avgDistanceMiles?: number;
  megastoreRisk?: boolean;              // Large national within 3mi
  notes: string;
}

// ============================================================================
// LOCAL SCAN RESULT (SS.01.06)
// ============================================================================

export interface LocalAmenity {
  type: string;                         // e.g., 'highway', 'retail', 'residential'
  name: string;
  distanceMiles: number;
}

export interface LocalScanResult {
  status: SpokeStatus;
  nearbyAmenities?: LocalAmenity[];
  highwayAccessMiles?: number;
  retailCenterMiles?: number;
  residentialDensity?: 'high' | 'medium' | 'low';
  visibilityScore?: number;             // 0-100
  accessScore?: number;                 // 0-100
  trafficScore?: number;                // 0-100
  overallLocalScore?: number;           // 0-100
  notes: string;
}

// ============================================================================
// HOTSPOT SCORING RESULT (SS.01.07)
// ============================================================================

export interface ScoreBreakdown {
  demandContribution: number;
  supplyContribution: number;
  competitionContribution: number;
  localContribution: number;
}

export interface HotspotScoringResult {
  status: SpokeStatus;
  hotspotScore?: number;                // 0-100 composite score
  tier?: 'A' | 'B' | 'C' | 'D';
  scoreBreakdown?: ScoreBreakdown;
  strengths?: string[];
  weaknesses?: string[];
  notes: string;
}

// ============================================================================
// VALIDATION GATE RESULT (SS.01.08)
// ============================================================================

export interface ValidationGateResult {
  status: SpokeStatus;
  isValid?: boolean;
  promotionDecision?: 'PROMOTE' | 'REVIEW' | 'REJECT';
  validationScore?: number;             // 0-100
  requiredFieldsPresent?: boolean;
  dataQualityScore?: number;            // 0-100
  blockers?: string[];
  warnings?: string[];
  recommendations?: string[];
  notes: string;
}

// ============================================================================
// PASS-1 INPUT
// ============================================================================

export interface Pass1Input {
  zipCode: string;
  state: string;
  radiusMiles?: number;                 // Default 120
}

// ============================================================================
// PASS-1 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass1Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  zipCode: string;
  state: string;
  zipHydration: ZipHydrationResult;
  radiusBuilder: RadiusBuilderResult;
  macroDemand: MacroDemandResult;
  macroSupply: MacroSupplyResult;
  competitorRegistry: CompetitorRegistryResult;
  localScan: LocalScanResult;
  hotspotScoring: HotspotScoringResult;
  validationGate: ValidationGateResult;
  error?: string;
}

// ============================================================================
// OPPORTUNITY OBJECT ENHANCEMENT
// ============================================================================

export interface OpportunityEnrichment {
  // From ZIP Hydration
  city: string;
  county: string;
  countyFips: string;
  lat: number;
  lng: number;
  population: number;
  medianHouseholdIncome: number;

  // From Demand/Supply
  baseDemandSqft: number;
  totalSupplySqft: number;
  supplyGapSqft: number;
  sqftPerCapita: number;

  // From Competitors
  competitorCount: number;
  nearestCompetitorMiles: number;
  nationalBrandCount: number;
  megastoreRisk: boolean;

  // From Scoring
  hotspotScore: number;
  tier: 'A' | 'B' | 'C' | 'D';
  promotionDecision: 'PROMOTE' | 'REVIEW' | 'REJECT';
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubZipHydration(): ZipHydrationResult {
  return {
    status: 'stub',
    notes: 'ZIP hydration not implemented. TODO: Integrate Census API.',
  };
}

export function createStubRadiusBuilder(): RadiusBuilderResult {
  return {
    status: 'stub',
    notes: 'Radius builder not implemented. TODO: Implement Haversine calculation.',
  };
}

export function createStubMacroDemand(): MacroDemandResult {
  return {
    status: 'stub',
    notes: 'Macro demand not implemented. TODO: Calculate population x 6 sqft.',
  };
}

export function createStubMacroSupply(): MacroSupplyResult {
  return {
    status: 'stub',
    notes: 'Macro supply not implemented. TODO: Aggregate competitor sqft.',
  };
}

export function createStubCompetitorRegistry(): CompetitorRegistryResult {
  return {
    status: 'stub',
    notes: 'Competitor registry not implemented. TODO: Integrate Google Places.',
  };
}

export function createStubLocalScan(): LocalScanResult {
  return {
    status: 'stub',
    notes: 'Local scan not implemented. TODO: Scan nearby amenities.',
  };
}

export function createStubHotspotScoring(): HotspotScoringResult {
  return {
    status: 'stub',
    notes: 'Hotspot scoring not implemented. TODO: Calculate weighted score.',
  };
}

export function createStubValidationGate(): ValidationGateResult {
  return {
    status: 'stub',
    notes: 'Validation gate not implemented. TODO: Validate required fields.',
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
