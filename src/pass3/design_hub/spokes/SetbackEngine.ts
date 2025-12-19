/**
 * SetbackEngine.ts - Pass-3 Spoke (Vault Logger)
 * Doctrine ID: SS.03.01
 * Purpose: Log setback/buildable area results to vault
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

export interface SetbackEngineResult {
  /** Total parcel area in square feet */
  grossAreaSqFt: number;

  /** Buildable area after setbacks in square feet */
  netBuildableAreaSqFt: number;

  /** Buildable percentage (net/gross) */
  buildablePct: number;

  /** Setbacks used (in feet) */
  setbacksUsed: {
    front: number;
    side: number;
    rear: number;
  };

  /** Source of setbacks */
  setbackSource: 'jurisdiction_card' | 'override' | 'default';

  /** Which constraints are binding (reduce area most) */
  bindingConstraints: string[];

  /** Parcel dimensions if known */
  parcelWidth?: number;
  parcelDepth?: number;

  /** Acreage */
  acreage?: number;

  /** Notes/warnings */
  notes: string[];
}

export interface SetbackEngineVaultEntry {
  spokeId: 'SS.03.01';
  status: 'logged';
  opportunityId: string;
  result: SetbackEngineResult;
  timestamp: string;
  source: 'lovable';
}

// ============================================================================
// VAULT LOGGER
// ============================================================================

/**
 * Log setback engine results to vault.
 * Results are calculated in Lovable.dev - this only persists them.
 */
export async function logSetbackToVault(
  opportunityId: string,
  result: SetbackEngineResult
): Promise<SetbackEngineVaultEntry> {
  console.log('[SETBACK_ENGINE] Logging to vault:', {
    opportunityId,
    grossSqFt: result.grossAreaSqFt,
    netSqFt: result.netBuildableAreaSqFt,
    buildablePct: result.buildablePct,
  });

  const entry: SetbackEngineVaultEntry = {
    spokeId: 'SS.03.01',
    status: 'logged',
    opportunityId,
    result,
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };

  try {
    await neonAdapter.insertVaultRecord({
      opportunity_id: opportunityId,
      spoke_id: 'SS.03.01',
      spoke_name: 'SetbackEngine',
      pass_number: 3,
      result_json: result,
      status: 'logged',
    });

    console.log('[SETBACK_ENGINE] Vault write successful');
  } catch (error) {
    console.error('[SETBACK_ENGINE] Vault write failed:', error);
  }

  return entry;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use logSetbackToVault instead
 */
export async function runSetbackEngine(input: {
  countyId?: number;
  parcelWidth?: number;
  parcelDepth?: number;
  acreage: number;
  setbackOverrides?: { front?: number; side?: number; rear?: number };
}): Promise<SetbackEngineVaultEntry> {
  console.warn('[SETBACK_ENGINE] runSetbackEngine is deprecated. Calculations should happen in Lovable.dev');

  return {
    spokeId: 'SS.03.01',
    status: 'logged',
    opportunityId: 'STUB',
    result: {
      grossAreaSqFt: 0,
      netBuildableAreaSqFt: 0,
      buildablePct: 0,
      setbacksUsed: { front: 0, side: 0, rear: 0 },
      setbackSource: 'default',
      bindingConstraints: [],
      notes: ['Stub - calculations in Lovable.dev'],
    },
    timestamp: new Date().toISOString(),
    source: 'lovable',
  };
}
