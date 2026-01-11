/**
 * PhasePlanner.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.04
 * Purpose: Log phase planning results to vault
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

export interface PhaseDetail {
  /** Phase number */
  phaseNumber: number;

  /** Phase name */
  phaseName?: string;

  /** Units in this phase */
  units: number;

  /** Square feet in this phase */
  sqFt: number;

  /** Construction start (month from project start) */
  constructionStartMonth: number;

  /** Construction duration (months) */
  constructionMonths: number;

  /** Lease-up start (month from project start) */
  leaseUpStartMonth: number;

  /** Months to stabilization */
  leaseUpMonths: number;

  /** Development cost for this phase */
  phaseCost?: number;
}

export interface PhasePlannerResult {
  /** Individual phases */
  phases: PhaseDetail[];

  /** Total number of phases */
  totalPhases: number;

  /** Total construction duration (months) */
  constructionMonths: number;

  /** Total lease-up period (months) */
  leaseUpMonths: number;

  /** Total project timeline (months) */
  totalProjectMonths?: number;

  /** Stabilization date (months from start) */
  stabilizationMonth?: number;

  /** Total units across all phases */
  totalUnits?: number;

  /** Total square feet across all phases */
  totalSqFt?: number;

  /** Notes */
  notes?: string[];
}

export interface PhasePlannerVaultEntry {
  spokeId: 'SS.03.04';
  status: 'logged';
  opportunityId: string;
  result: PhasePlannerResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log phase planner results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logPhasePlanToVault(
  opportunityId: string,
  result: PhasePlannerResult
): Promise<PhasePlannerVaultEntry> {
  console.log('[PHASE_PLANNER] Logging to vault:', {
    opportunityId,
    totalPhases: result.totalPhases,
    constructionMonths: result.constructionMonths,
    leaseUpMonths: result.leaseUpMonths,
  });

  const entry: PhasePlannerVaultEntry = {
    spokeId: 'SS.03.04',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.04',
      spoke_name: 'PhasePlanner',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[PHASE_PLANNER] Vault write successful');
  } catch (error) {
    console.error('[PHASE_PLANNER] Vault write failed:', error);
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logPhasePlanToVault instead
 */
export async function runPhasePlanner(input: {
  totalUnits: number;
  totalSqFt: number;
}): Promise<PhasePlannerVaultEntry> {
  console.warn('[PHASE_PLANNER] runPhasePlanner is deprecated. Calculations should happen in Lovable.dev');

  return {
    spokeId: 'SS.03.04',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      phases: [],
      totalPhases: 1,
      constructionMonths: 12,
      leaseUpMonths: 18,
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
