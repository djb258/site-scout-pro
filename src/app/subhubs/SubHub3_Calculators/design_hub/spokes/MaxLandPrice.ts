/**
 * MaxLandPrice.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.08
 * Purpose: Log max land price results to vault
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

export interface ResidualAnalysis {
  /** Stabilized value (NOI / cap rate) */
  stabilizedValue: number;

  /** Total development costs (excluding land) */
  totalCosts: number;

  /** Required developer profit/margin */
  developerProfit: number;

  /** Residual land value */
  residualLandValue: number;

  /** Cap rate used */
  capRate?: number;

  /** Target IRR used */
  targetIRR?: number;
}

export interface MaxLandPriceResult {
  /** Maximum supportable land price */
  maxLandPrice: number;

  /** Price per acre */
  pricePerAcre: number;

  /** Residual analysis details */
  residualAnalysis: ResidualAnalysis;

  /** Acreage */
  acreage?: number;

  /** Price per square foot of land */
  pricePerSqFt?: number;

  /** Sensitivity analysis */
  sensitivity?: {
    capRatePlus25bps?: number;
    capRateMinus25bps?: number;
    noiPlus5Pct?: number;
    noiMinus5Pct?: number;
  };

  /** Notes */
  notes?: string[];
}

export interface MaxLandPriceVaultEntry {
  spokeId: 'SS.03.08';
  status: 'logged';
  opportunityId: string;
  result: MaxLandPriceResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log max land price results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logMaxLandPriceToVault(
  opportunityId: string,
  result: MaxLandPriceResult
): Promise<MaxLandPriceVaultEntry> {
  console.log('[MAX_LAND_PRICE] Logging to vault:', {
    opportunityId,
    maxLandPrice: result.maxLandPrice,
    pricePerAcre: result.pricePerAcre,
  });

  const entry: MaxLandPriceVaultEntry = {
    spokeId: 'SS.03.08',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.08',
      spoke_name: 'MaxLandPrice',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[MAX_LAND_PRICE] Vault write successful');
  } catch (error) {
    console.error('[MAX_LAND_PRICE] Vault write failed:', error);
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logMaxLandPriceToVault instead
 */
export async function runMaxLandPrice(input: {
  noi: number;
  buildCosts: number;
  targetIRR: number;
  acreage: number;
}): Promise<MaxLandPriceVaultEntry> {
  console.warn('[MAX_LAND_PRICE] runMaxLandPrice is deprecated. Calculations should happen in Lovable.dev');

  return {
    spokeId: 'SS.03.08',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      maxLandPrice: 0,
      pricePerAcre: 0,
      residualAnalysis: {
        stabilizedValue: 0,
        totalCosts: input.buildCosts,
        developerProfit: 0,
        residualLandValue: 0,
      },
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
