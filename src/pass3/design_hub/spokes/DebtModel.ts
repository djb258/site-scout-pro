/**
 * DebtModel.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.07
 * Purpose: Log debt model results to vault
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

export interface DebtModelResult {
  /** Loan amount */
  loanAmount: number;

  /** Interest rate (decimal, e.g., 0.065 = 6.5%) */
  interestRate: number;

  /** Loan term in years */
  termYears: number;

  /** Annual debt service payment */
  annualDebtService: number;

  /** Debt Service Coverage Ratio */
  dscr: number;

  /** Loan-to-Value ratio */
  ltv: number;

  /** Loan-to-Cost ratio */
  ltc?: number;

  /** Monthly payment */
  monthlyPayment?: number;

  /** Total development cost */
  totalDevelopmentCost?: number;

  /** NOI used for DSCR calculation */
  noi?: number;
}

export interface DebtModelVaultEntry {
  spokeId: 'SS.03.07';
  status: 'logged';
  opportunityId: string;
  result: DebtModelResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log debt model results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logDebtModelToVault(
  opportunityId: string,
  result: DebtModelResult
): Promise<DebtModelVaultEntry> {
  console.log('[DEBT_MODEL] Logging to vault:', {
    opportunityId,
    loanAmount: result.loanAmount,
    dscr: result.dscr,
    ltv: result.ltv,
  });

  const entry: DebtModelVaultEntry = {
    spokeId: 'SS.03.07',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.07',
      spoke_name: 'DebtModel',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[DEBT_MODEL] Vault write successful');
  } catch (error) {
    console.error('[DEBT_MODEL] Vault write failed:', error);
    // Don't throw - logging failure shouldn't break the pipeline
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logDebtModelToVault instead
 */
export async function runDebtModel(input: {
  totalDevelopmentCost: number;
  noi: number;
  targetDSCR: number;
}): Promise<DebtModelVaultEntry> {
  console.warn('[DEBT_MODEL] runDebtModel is deprecated. Calculations should happen in Lovable.dev');

  // Return stub - actual calculations happen in Lovable.dev
  return {
    spokeId: 'SS.03.07',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      loanAmount: 0,
      interestRate: 0,
      termYears: 0,
      annualDebtService: 0,
      dscr: input.targetDSCR,
      ltv: 0,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
