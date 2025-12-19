/**
 * CoverageEngine.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.02
 * Purpose: Log coverage/footprint results to vault
 *
 * ============================================================================
 * DOCTRINE
 * ============================================================================
 *
 * Pass 3 calculations are performed in Lovable.dev.
 * This spoke ONLY logs results to the Neon vault.
 * NO calculations happen here.
 *
 * ============================================================================
 */

import { neonAdapter } from '../../../shared/data_layer/adapters/NeonAdapter';

// ============================================================================
// TYPES
// ============================================================================

export interface CoverageEngineResult {
  /** Maximum buildable square feet */
  maxBuildableSqFt: number;

  /** Lot coverage percentage used */
  coveragePercent: number;

  /** Number of stories */
  stories: number;

  /** Building footprint in square feet */
  footprintSqFt: number;

  /** Maximum height allowed (feet) */
  maxHeight?: number;

  /** Floor Area Ratio if applicable */
  far?: number;

  /** Gross building area */
  grossBuildingArea?: number;

  /** Net rentable area */
  netRentableArea?: number;

  /** Efficiency factor (net/gross) */
  efficiencyFactor?: number;

  /** Notes */
  notes?: string[];
}

export interface CoverageEngineVaultEntry {
  spokeId: 'SS.03.02';
  status: 'logged';
  opportunityId: string;
  result: CoverageEngineResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log coverage engine results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logCoverageToVault(
  opportunityId: string,
  result: CoverageEngineResult
): Promise<CoverageEngineVaultEntry> {
  console.log('[COVERAGE_ENGINE] Logging to vault:', {
    opportunityId,
    maxBuildableSqFt: result.maxBuildableSqFt,
    footprintSqFt: result.footprintSqFt,
    stories: result.stories,
  });

  const entry: CoverageEngineVaultEntry = {
    spokeId: 'SS.03.02',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.02',
      spoke_name: 'CoverageEngine',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[COVERAGE_ENGINE] Vault write successful');
  } catch (error) {
    console.error('[COVERAGE_ENGINE] Vault write failed:', error);
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logCoverageToVault instead
 */
export async function runCoverageEngine(input: {
  buildableArea: number;
  maxCoverage: number;
  maxHeight: number;
  maxStories: number;
}): Promise<CoverageEngineVaultEntry> {
  console.warn('[COVERAGE_ENGINE] runCoverageEngine is deprecated. Calculations should happen in Lovable.dev');

  return {
    spokeId: 'SS.03.02',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      maxBuildableSqFt: 0,
      coveragePercent: 0,
      stories: 0,
      footprintSqFt: 0,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
