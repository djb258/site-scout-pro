/**
 * IRRModel.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.09
 * Purpose: Log IRR/returns results to vault
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

export interface IRRModelResult {
  /** Project-level IRR (unlevered) */
  projectIRR: number;

  /** Equity IRR (levered) */
  equityIRR?: number;

  /** Equity multiple (total equity returned / equity invested) */
  equityMultiple: number;

  /** Cash-on-cash returns by year */
  cashOnCash: number[];

  /** Net Present Value */
  npv: number;

  /** Discount rate used for NPV */
  discountRate?: number;

  /** Payback period in years */
  paybackPeriod: number;

  /** Exit cap rate assumption */
  exitCapRate: number;

  /** Exit/reversion value */
  exitValue: number;

  /** Hold period in years */
  holdPeriodYears?: number;

  /** Total equity invested */
  equityInvested?: number;

  /** Annual cash flows */
  cashFlows?: number[];
}

export interface IRRModelVaultEntry {
  spokeId: 'SS.03.09';
  status: 'logged';
  opportunityId: string;
  result: IRRModelResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log IRR model results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logIRRModelToVault(
  opportunityId: string,
  result: IRRModelResult
): Promise<IRRModelVaultEntry> {
  console.log('[IRR_MODEL] Logging to vault:', {
    opportunityId,
    projectIRR: result.projectIRR,
    equityMultiple: result.equityMultiple,
    npv: result.npv,
  });

  const entry: IRRModelVaultEntry = {
    spokeId: 'SS.03.09',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.09',
      spoke_name: 'IRRModel',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[IRR_MODEL] Vault write successful');
  } catch (error) {
    console.error('[IRR_MODEL] Vault write failed:', error);
    // Don't throw - logging failure shouldn't break the pipeline
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logIRRModelToVault instead
 */
export async function runIRRModel(input: {
  buildCosts: number;
  noi: number;
  debtService: number;
  holdPeriodYears: number;
  loanAmount: number;
}): Promise<IRRModelVaultEntry> {
  console.warn('[IRR_MODEL] runIRRModel is deprecated. Calculations should happen in Lovable.dev');

  // Return stub - actual calculations happen in Lovable.dev
  return {
    spokeId: 'SS.03.09',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      projectIRR: 0,
      equityMultiple: 0,
      cashOnCash: [],
      npv: 0,
      paybackPeriod: 0,
      exitCapRate: 0,
      exitValue: 0,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
