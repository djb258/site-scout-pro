/**
 * BuildCostModel.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.05
 * Purpose: Log build cost results to vault
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

export interface BuildCostModelResult {
  /** Hard construction costs */
  hardCosts: number;

  /** Soft costs (design, permits, fees) */
  softCosts: number;

  /** Contingency amount */
  contingency: number;

  /** Total development cost */
  totalDevelopmentCost: number;

  /** Cost per square foot */
  costPerSqFt: number;

  /** Total building square footage */
  totalSqFt?: number;

  /** Number of stories */
  stories?: number;

  /** Land cost */
  landCost?: number;

  /** Financing costs */
  financingCosts?: number;

  /** Tenant improvements */
  tenantImprovements?: number;

  /** Cost breakdown by category */
  costBreakdown?: {
    sitework?: number;
    foundation?: number;
    structure?: number;
    envelope?: number;
    mep?: number;
    interior?: number;
    landscaping?: number;
  };

  /** Notes */
  notes?: string[];
}

export interface BuildCostModelVaultEntry {
  spokeId: 'SS.03.05';
  status: 'logged';
  opportunityId: string;
  result: BuildCostModelResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log build cost model results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logBuildCostToVault(
  opportunityId: string,
  result: BuildCostModelResult
): Promise<BuildCostModelVaultEntry> {
  console.log('[BUILD_COST_MODEL] Logging to vault:', {
    opportunityId,
    totalDevelopmentCost: result.totalDevelopmentCost,
    costPerSqFt: result.costPerSqFt,
  });

  const entry: BuildCostModelVaultEntry = {
    spokeId: 'SS.03.05',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.05',
      spoke_name: 'BuildCostModel',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[BUILD_COST_MODEL] Vault write successful');
  } catch (error) {
    console.error('[BUILD_COST_MODEL] Vault write failed:', error);
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logBuildCostToVault instead
 */
export async function runBuildCostModel(input: {
  totalSqFt: number;
  stories: number;
  phases: any[];
}): Promise<BuildCostModelVaultEntry> {
  console.warn('[BUILD_COST_MODEL] runBuildCostModel is deprecated. Calculations should happen in Lovable.dev');

  return {
    spokeId: 'SS.03.05',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      hardCosts: 0,
      softCosts: 0,
      contingency: 0,
      totalDevelopmentCost: 0,
      costPerSqFt: 0,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
