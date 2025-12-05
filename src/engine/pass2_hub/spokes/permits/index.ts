/**
 * PERMITS SPOKE
 *
 * Responsibility: Fetch and analyze permit requirements and timelines
 *
 * Inputs:
 *   - county_fips: string
 *   - state: string
 *
 * Outputs:
 *   - PermitResult with timeline, fees, complexity
 *
 * Data Sources:
 *   - Lovable.DB: jurisdiction_permits scratchpad table
 *   - Computed estimates based on jurisdiction characteristics
 */

import type { PermitIntel, OpportunityObject } from '../../../shared/opportunity_object';
import type { PermitResult } from '../../types/pass2_types';
import { createStubPermit, createErrorResult } from '../../types/pass2_types';
import { queryData, writeLog } from '../../../shared/lovable_adapter';

export interface PermitInput {
  county_fips?: string;
  state: string;
  county: string;
}

export interface PermitOutput {
  success: boolean;
  permit_intel: PermitIntel | null;
  data_source: 'neon' | 'scraper' | 'manual' | 'none';
  error?: string;
}

/**
 * Permit record from scratchpad
 */
interface PermitRecord {
  jurisdiction_id: string;
  county: string;
  state: string;
  county_fips?: string;
  permit_risk_level?: 'low' | 'medium' | 'high' | 'very_high';
  estimated_timeline_days?: number;
  total_fees?: number;
  complexity?: 'low' | 'moderate' | 'high' | 'very_high';
  key_requirements?: string[];
  critical_path?: string[];
  portal_url?: string;
  portal_platform?: string;
  notes?: string;
}

// ============================================================================
// PERMIT ANALYSIS LOGIC
// ============================================================================

/**
 * Estimate permit fees based on state and project size
 * Industry standard: ~$10-20/sqft in permit fees for commercial
 */
function estimatePermitFees(state: string, acreagePlanned?: number): number {
  const baseFee = 5000; // Base filing fee
  const sqftEstimate = (acreagePlanned || 3) * 43560 * 0.4; // 40% building footprint
  const perSqftRate = getStateFeeRate(state);

  return Math.round(baseFee + (sqftEstimate * perSqftRate));
}

/**
 * Get per-sqft permit fee rate by state
 */
function getStateFeeRate(state: string): number {
  // High-cost states
  const highCostStates = ['CA', 'NY', 'NJ', 'MA', 'CT', 'WA', 'HI'];
  // Medium-cost states
  const mediumCostStates = ['TX', 'FL', 'VA', 'MD', 'PA', 'IL', 'CO', 'AZ'];
  // Low-cost states get default

  if (highCostStates.includes(state)) return 0.35;
  if (mediumCostStates.includes(state)) return 0.20;
  return 0.12; // Low-cost default
}

/**
 * Estimate timeline based on complexity
 */
function estimateTimelineDays(complexity: PermitResult['complexity']): { min: number; max: number; expected: number } {
  switch (complexity) {
    case 'low':
      return { min: 30, max: 60, expected: 45 };
    case 'moderate':
      return { min: 60, max: 120, expected: 90 };
    case 'high':
      return { min: 120, max: 180, expected: 150 };
    case 'very_high':
      return { min: 180, max: 365, expected: 270 };
    default:
      return { min: 90, max: 120, expected: 105 };
  }
}

/**
 * Determine permit complexity based on jurisdiction characteristics
 */
function determineComplexity(
  state: string,
  county: string,
  requiresCUP: boolean,
  requiresVariance: boolean
): PermitResult['complexity'] {
  // High-regulation states
  const highRegStates = ['CA', 'NY', 'NJ', 'MA', 'WA'];

  if (requiresVariance || highRegStates.includes(state)) {
    return requiresVariance ? 'very_high' : 'high';
  }

  if (requiresCUP) {
    return 'high';
  }

  // Check for typically complex counties
  const complexCountyPatterns = ['los angeles', 'new york', 'san francisco', 'cook', 'miami-dade'];
  const lowerCounty = county.toLowerCase();
  if (complexCountyPatterns.some(p => lowerCounty.includes(p))) {
    return 'high';
  }

  return 'moderate';
}

/**
 * Determine permit risk level
 */
function determinePermitRisk(
  complexity: PermitResult['complexity'],
  requiresVariance: boolean
): PermitResult['permitRiskLevel'] {
  if (requiresVariance) return 'very_high';
  if (complexity === 'very_high') return 'very_high';
  if (complexity === 'high') return 'high';
  if (complexity === 'moderate') return 'medium';
  return 'low';
}

/**
 * Generate typical key requirements based on complexity
 */
function generateKeyRequirements(complexity: PermitResult['complexity']): string[] {
  const base = ['Building permit', 'Site plan review'];

  if (complexity === 'low') {
    return [...base, 'Grading permit'];
  }

  if (complexity === 'moderate') {
    return [...base, 'Stormwater management plan', 'Landscaping plan', 'Traffic impact letter'];
  }

  if (complexity === 'high') {
    return [
      ...base,
      'Stormwater management plan',
      'Traffic impact study',
      'Environmental review',
      'Public hearing',
      'Fire department review',
    ];
  }

  // very_high
  return [
    ...base,
    'Stormwater management plan',
    'Traffic impact study',
    'Environmental impact assessment',
    'Public hearings (multiple)',
    'Variance application',
    'Fire department review',
    'Planning commission approval',
  ];
}

/**
 * Generate critical path based on complexity
 */
function generateCriticalPath(complexity: PermitResult['complexity'], requiresCUP: boolean): string[] {
  if (complexity === 'low') {
    return ['Site plan submission', 'Building permit issuance'];
  }

  if (requiresCUP || complexity === 'high' || complexity === 'very_high') {
    return [
      'Pre-application meeting',
      'Conditional use permit application',
      'Public hearing',
      'CUP approval',
      'Site plan approval',
      'Building permit issuance',
    ];
  }

  return [
    'Site plan submission',
    'Agency reviews',
    'Site plan approval',
    'Building permit application',
    'Building permit issuance',
  ];
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Run permit analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @returns PermitResult with status, timeline, and fees
 */
export async function runPermitShell(opportunity: OpportunityObject): Promise<PermitResult> {
  console.log(`[PERMIT_SPOKE] Running permit analysis for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    // Query jurisdiction_permits scratchpad for this location
    const jurisdictionId = `${opportunity.identity.state}-${opportunity.identity.county.replace(/\s+/g, '_')}`;

    const records = await queryData<PermitRecord>('jurisdiction_permits', {
      jurisdiction_id: jurisdictionId,
    });

    let permitRecord: PermitRecord | undefined;
    if (records && records.length > 0) {
      permitRecord = records[0];
    }

    // Get zoning info to determine CUP/variance requirements
    const requiresCUP = opportunity.pass2_results?.zoning_intel?.conditional_use_required ?? true;
    const requiresVariance = opportunity.pass2_results?.zoning_intel?.variance_needed ?? false;

    // Build result from record or compute
    let complexity: PermitResult['complexity'];
    let totalFees: number;
    let keyRequirements: string[];
    let criticalPath: string[];
    let portalUrl: string | undefined;
    let portalPlatform: string | undefined;
    let dataSource = 'computed';

    if (permitRecord) {
      complexity = permitRecord.complexity || 'moderate';
      totalFees = permitRecord.total_fees || estimatePermitFees(opportunity.identity.state);
      keyRequirements = permitRecord.key_requirements || generateKeyRequirements(complexity);
      criticalPath = permitRecord.critical_path || generateCriticalPath(complexity, requiresCUP);
      portalUrl = permitRecord.portal_url;
      portalPlatform = permitRecord.portal_platform;
      dataSource = 'jurisdiction_permits';
    } else {
      complexity = determineComplexity(
        opportunity.identity.state,
        opportunity.identity.county,
        requiresCUP,
        requiresVariance
      );
      totalFees = estimatePermitFees(opportunity.identity.state);
      keyRequirements = generateKeyRequirements(complexity);
      criticalPath = generateCriticalPath(complexity, requiresCUP);
    }

    const permitRiskLevel = determinePermitRisk(complexity, requiresVariance);
    const timeline = estimateTimelineDays(complexity);
    const estimatedTimeline = `${timeline.min}-${timeline.max} days`;

    await writeLog('permit_analysis_complete', {
      county: opportunity.identity.county,
      state: opportunity.identity.state,
      complexity,
      permit_risk: permitRiskLevel,
      total_fees: totalFees,
      data_source: dataSource,
    });

    const result: PermitResult = {
      status: 'ok',
      permitRiskLevel,
      estimatedTimeline,
      totalFees,
      complexity,
      keyRequirements,
      criticalPath,
      portalUrl,
      portalPlatform,
      notes: `Permit analysis for ${opportunity.identity.county}, ${opportunity.identity.state}. Complexity: ${complexity}, Est. fees: $${totalFees.toLocaleString()}, Timeline: ${estimatedTimeline}. Data source: ${dataSource}.`,
    };

    console.log(`[PERMIT_SPOKE] Result: complexity=${result.complexity}, fees=$${result.totalFees}`);
    return result;
  } catch (error) {
    console.error('[PERMIT_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown permit error',
      createStubPermit
    );
  }
}

/**
 * Run permit analysis (Legacy Interface - Retained for Backwards Compatibility)
 */
export async function runPermits(input: PermitInput): Promise<PermitOutput> {
  console.log(`[PERMITS] Analyzing permits for ${input.county}, ${input.state}`);

  try {
    const jurisdictionId = `${input.state}-${input.county.replace(/\s+/g, '_')}`;
    const records = await queryData<PermitRecord>('jurisdiction_permits', {
      jurisdiction_id: jurisdictionId,
    });

    let permit_intel: PermitIntel;
    let data_source: PermitOutput['data_source'] = 'none';

    if (records && records.length > 0) {
      const record = records[0];
      permit_intel = {
        portal_url: record.portal_url,
        portal_platform: record.portal_platform,
        estimated_timeline: record.estimated_timeline_days
          ? `${record.estimated_timeline_days} days`
          : '90-120 days',
        total_fees: record.total_fees || 15000,
        complexity: record.complexity || 'moderate',
        key_requirements: record.key_requirements || ['Site plan review', 'Building permit'],
        critical_path: record.critical_path || ['Site plan', 'Building permit'],
      };
      data_source = 'neon';
    } else {
      const complexity = determineComplexity(input.state, input.county, true, false);
      const timeline = estimateTimelineDays(complexity);

      permit_intel = {
        portal_url: 'https://permits.county.gov',
        portal_platform: 'Custom',
        estimated_timeline: `${timeline.min}-${timeline.max} days`,
        total_fees: estimatePermitFees(input.state),
        complexity,
        key_requirements: generateKeyRequirements(complexity),
        critical_path: generateCriticalPath(complexity, true),
      };
    }

    return {
      success: true,
      permit_intel,
      data_source,
    };
  } catch (error) {
    console.error('[PERMITS] Error:', error);
    return {
      success: false,
      permit_intel: null,
      data_source: 'none',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate permit complexity score
 */
export function calculatePermitComplexity(permit: PermitIntel): number {
  let complexityScore = 50;

  switch (permit.complexity) {
    case 'low':
      complexityScore = 25;
      break;
    case 'moderate':
      complexityScore = 50;
      break;
    case 'high':
      complexityScore = 75;
      break;
    case 'very_high':
      complexityScore = 90;
      break;
  }

  // Adjust for requirements
  permit.key_requirements.forEach((req) => {
    const reqLower = req.toLowerCase();
    if (reqLower.includes('traffic')) complexityScore += 5;
    if (reqLower.includes('environmental')) complexityScore += 10;
    if (reqLower.includes('hearing')) complexityScore += 8;
    if (reqLower.includes('variance')) complexityScore += 15;
  });

  return Math.min(100, complexityScore);
}

/**
 * Estimate permit timeline in days
 */
export function estimateTimeline(complexity: PermitIntel['complexity']): {
  min_days: number;
  max_days: number;
  expected_days: number;
} {
  const timeline = estimateTimelineDays(complexity);
  return {
    min_days: timeline.min,
    max_days: timeline.max,
    expected_days: timeline.expected,
  };
}

// Re-export types for convenience
export type { PermitResult };
