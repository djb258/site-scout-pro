/**
 * NOIEngine.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.06
 * Purpose: Log NOI results to vault
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
  /** Unit type name (e.g., "5x5", "10x10", "10x20") */
  type: string;

  /** Square feet per unit */
  sqFt: number;

  /** Number of units */
  count: number;

  /** Monthly rate per unit */
  monthlyRate: number;

  /** Optional: climate controlled */
  climateControlled?: boolean;
}

export interface NOIEngineResult {
  /** Gross Potential Rent (annual) */
  grossPotentialRent: number;

  /** Vacancy Loss (annual) */
  vacancyLoss: number;

  /** Concessions (annual) */
  concessions: number;

  /** Other Income (annual) */
  otherIncome: number;

  /** Effective Gross Income (annual) */
  effectiveGrossIncome: number;

  /** Operating Expenses (annual) */
  operatingExpenses: number;

  /** Net Operating Income (annual) */
  netOperatingIncome: number;

  /** Expense ratio used */
  expenseRatio: number;

  /** Occupancy rate used */
  occupancyRate: number;

  /** NOI per unit */
  noiPerUnit: number;

  /** NOI per square foot */
  noiPerSqFt: number;

  /** Average monthly rate per unit */
  avgMonthlyRatePerUnit: number;

  /** Average monthly rate per square foot */
  avgMonthlyRatePerSqFt: number;

  /** Total rentable square feet */
  totalRentableSqFt: number;

  /** Total units */
  totalUnits: number;

  /** Unit mix used */
  unitMix?: UnitMixItem[];
}

export interface NOIEngineVaultEntry {
  spokeId: 'SS.03.06';
  status: 'logged';
  opportunityId: string;
  result: NOIEngineResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log NOI results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logNOIToVault(
  opportunityId: string,
  result: NOIEngineResult
): Promise<NOIEngineVaultEntry> {
  console.log('[NOI_ENGINE] Logging to vault:', {
    opportunityId,
    noi: result.netOperatingIncome,
    gpr: result.grossPotentialRent,
    egi: result.effectiveGrossIncome,
  });

  const entry: NOIEngineVaultEntry = {
    spokeId: 'SS.03.06',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.06',
      spoke_name: 'NOIEngine',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[NOI_ENGINE] Vault write successful');
  } catch (error) {
    console.error('[NOI_ENGINE] Vault write failed:', error);
    // Don't throw - logging failure shouldn't break the pipeline
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logNOIToVault instead
 */
export async function runNOIEngine(input: {
  unitMix: UnitMixItem[];
  totalUnits: number;
  targetOccupancy?: number;
  expenseRatio?: number;
  otherIncome?: number;
  concessions?: number;
}): Promise<NOIEngineVaultEntry> {
  console.warn('[NOI_ENGINE] runNOIEngine is deprecated. Calculations should happen in Lovable.dev');

  // Return stub - actual calculations happen in Lovable.dev
  return {
    spokeId: 'SS.03.06',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      grossPotentialRent: 0,
      vacancyLoss: 0,
      concessions: 0,
      otherIncome: 0,
      effectiveGrossIncome: 0,
      operatingExpenses: 0,
      netOperatingIncome: 0,
      expenseRatio: 0,
      occupancyRate: 0,
      noiPerUnit: 0,
      noiPerSqFt: 0,
      avgMonthlyRatePerUnit: 0,
      avgMonthlyRatePerSqFt: 0,
      totalRentableSqFt: 0,
      totalUnits: input.totalUnits,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
