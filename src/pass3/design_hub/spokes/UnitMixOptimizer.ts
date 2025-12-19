/**
 * UnitMixOptimizer.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.03
 * Purpose: Log unit mix optimization results to vault
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

export interface UnitMixItem {
  /** Unit type (e.g., "5x5", "10x10") */
  type: string;

  /** Square feet per unit */
  sqFt: number;

  /** Number of units */
  count: number;

  /** Monthly rate per unit */
  monthlyRate: number;

  /** Climate controlled */
  climateControlled?: boolean;

  /** Drive-up access */
  driveUp?: boolean;
}

export interface UnitMixOptimizerResult {
  /** Optimized unit mix */
  unitMix: UnitMixItem[];

  /** Total number of units */
  totalUnits: number;

  /** Total rentable square feet */
  totalSqFt: number;

  /** Average rent per square foot */
  avgRentPerSqFt: number;

  /** Projected gross potential rent (annual) */
  projectedGPR?: number;

  /** Optimization score */
  optimizationScore?: number;

  /** Climate controlled percentage */
  climateControlledPct?: number;

  /** Drive-up percentage */
  driveUpPct?: number;

  /** Notes */
  notes?: string[];
}

export interface UnitMixOptimizerVaultEntry {
  spokeId: 'SS.03.03';
  status: 'logged';
  opportunityId: string;
  result: UnitMixOptimizerResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log unit mix optimizer results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logUnitMixToVault(
  opportunityId: string,
  result: UnitMixOptimizerResult
): Promise<UnitMixOptimizerVaultEntry> {
  console.log('[UNIT_MIX_OPTIMIZER] Logging to vault:', {
    opportunityId,
    totalUnits: result.totalUnits,
    totalSqFt: result.totalSqFt,
    avgRentPerSqFt: result.avgRentPerSqFt,
  });

  const entry: UnitMixOptimizerVaultEntry = {
    spokeId: 'SS.03.03',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.03',
      spoke_name: 'UnitMixOptimizer',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[UNIT_MIX_OPTIMIZER] Vault write successful');
  } catch (error) {
    console.error('[UNIT_MIX_OPTIMIZER] Vault write failed:', error);
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logUnitMixToVault instead
 */
export async function runUnitMixOptimizer(input: {
  totalSqFt: number;
  pass2RunId: string;
}): Promise<UnitMixOptimizerVaultEntry> {
  console.warn('[UNIT_MIX_OPTIMIZER] runUnitMixOptimizer is deprecated. Calculations should happen in Lovable.dev');

  return {
    spokeId: 'SS.03.03',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      unitMix: [],
      totalUnits: 0,
      totalSqFt: input.totalSqFt,
      avgRentPerSqFt: 0,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
