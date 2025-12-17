/**
 * PASS-0 TYPE DEFINITIONS
 *
 * Type definitions for Pass-0 Radar Hub (SS.00.00)
 * Momentum signal aggregation and trend detection.
 *
 * All types are JSON-serializable for edge/cloud function execution.
 */

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// TREND SIGNAL RESULT (SS.00.01)
// ============================================================================

export interface TrendSignalResult {
  status: SpokeStatus;
  searchInterestIndex?: number;        // 0-100 Google Trends index
  searchVolumeGrowthPct?: number;      // YoY growth percentage
  relatedQueries?: string[];
  trendDirection?: 'rising' | 'stable' | 'declining';
  peakMonth?: string;
  seasonalityFactor?: number;          // 0-2 multiplier
  score?: number;                      // 0-100 normalized score
  notes: string;
}

// ============================================================================
// PERMIT ACTIVITY RESULT (SS.00.02)
// ============================================================================

export interface PermitActivityResult {
  status: SpokeStatus;
  permitCount12mo?: number;
  permitValueTotal?: number;
  commercialPermitGrowthPct?: number;
  residentialPermitGrowthPct?: number;
  newConstructionRatio?: number;        // % new vs renovation
  avgPermitValue?: number;
  largestPermitValue?: number;
  permittingTrend?: 'accelerating' | 'stable' | 'slowing';
  score?: number;                       // 0-100 normalized score
  notes: string;
}

// ============================================================================
// NEWS EVENTS RESULT (SS.00.03)
// ============================================================================

export interface NewsEvent {
  headline: string;
  source: string;
  date: string;
  category: 'employer' | 'infrastructure' | 'development' | 'economic' | 'other';
  sentiment: 'positive' | 'neutral' | 'negative';
  impactScore: number;                  // 1-10
}

export interface NewsEventsResult {
  status: SpokeStatus;
  eventCount?: number;
  majorEmployerAnnouncements?: number;
  infrastructureProjects?: number;
  newDevelopments?: number;
  overallSentiment?: 'positive' | 'neutral' | 'negative';
  topEvents?: NewsEvent[];
  sentimentScore?: number;              // -100 to +100
  score?: number;                       // 0-100 normalized score
  notes: string;
}

// ============================================================================
// INDUSTRIAL LOGISTICS RESULT (SS.00.04)
// ============================================================================

export interface IndustrialLogisticsResult {
  status: SpokeStatus;
  warehouseVacancyPct?: number;
  newLogisticsFacilities?: number;
  freightVolumeGrowthPct?: number;
  industrialAbsorptionSqft?: number;
  lastMileDeliveryGrowth?: number;      // % growth
  majorDistributionCenters?: number;
  industrialRentPsf?: number;
  logisticsDemandTrend?: 'strong' | 'moderate' | 'weak';
  score?: number;                       // 0-100 normalized score
  notes: string;
}

// ============================================================================
// HOUSING PIPELINE RESULT (SS.00.05)
// ============================================================================

export interface HousingPipelineResult {
  status: SpokeStatus;
  multifamilyUnitsPermitted?: number;
  singleFamilyStarts?: number;
  housingUnitsUnderConstruction?: number;
  projectedCompletions12mo?: number;
  affordableHousingPct?: number;
  rentalDemandIndex?: number;           // 0-100
  supplyPressure?: 'high' | 'moderate' | 'low';
  avgNewHomePrice?: number;
  score?: number;                       // 0-100 normalized score
  notes: string;
}

// ============================================================================
// MOMENTUM FUSION RESULT (SS.00.06)
// ============================================================================

export interface MomentumContributor {
  spoke: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface MomentumFusionResult {
  status: SpokeStatus;
  fusedMomentumScore?: number;          // 0-100 final fused score
  confidenceLevel?: 'high' | 'medium' | 'low';
  trendDirection?: 'rising' | 'stable' | 'declining';
  topContributors?: MomentumContributor[];
  bottomContributors?: MomentumContributor[];
  signalStrength?: 'strong' | 'moderate' | 'weak';
  dataCompleteness?: number;            // 0-100 % of signals available
  recommendations?: string[];
  notes: string;
}

// ============================================================================
// PASS-0 INPUT
// ============================================================================

export interface Pass0Input {
  zipCode: string;
  state: string;
  city?: string;
  county?: string;
  lat?: number;
  lng?: number;
}

// ============================================================================
// PASS-0 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass0Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  zipCode: string;
  state: string;
  trendSignal: TrendSignalResult;
  permitActivity: PermitActivityResult;
  newsEvents: NewsEventsResult;
  industrialLogistics: IndustrialLogisticsResult;
  housingPipeline: HousingPipelineResult;
  momentumFusion: MomentumFusionResult;
  error?: string;
}

// ============================================================================
// MOMENTUM ANALYSIS (Final Export Object)
// ============================================================================

export interface MomentumAnalysis {
  zipCode: string;
  state: string;
  fusedMomentumScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  trendDirection: 'rising' | 'stable' | 'declining';
  topContributors: string[];
  timestamp: number;
  dataAge: number;                      // days since last refresh
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubTrendSignal(): TrendSignalResult {
  return {
    status: 'stub',
    notes: 'Trend signal not implemented. TODO: Integrate Google Trends API.',
  };
}

export function createStubPermitActivity(): PermitActivityResult {
  return {
    status: 'stub',
    notes: 'Permit activity not implemented. TODO: Integrate permit data source.',
  };
}

export function createStubNewsEvents(): NewsEventsResult {
  return {
    status: 'stub',
    notes: 'News events not implemented. TODO: Integrate news aggregation.',
  };
}

export function createStubIndustrialLogistics(): IndustrialLogisticsResult {
  return {
    status: 'stub',
    notes: 'Industrial logistics not implemented. TODO: Integrate CoStar/similar.',
  };
}

export function createStubHousingPipeline(): HousingPipelineResult {
  return {
    status: 'stub',
    notes: 'Housing pipeline not implemented. TODO: Integrate Census/permit data.',
  };
}

export function createStubMomentumFusion(): MomentumFusionResult {
  return {
    status: 'stub',
    notes: 'Momentum fusion not implemented. TODO: Implement weighted scoring.',
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
