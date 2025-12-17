/**
 * EDGE FUNCTION: save_to_vault
 *
 * Lovable.dev compatible edge function for saving to permanent storage
 * This is the ONLY edge function that writes to Neon (permanent storage)
 *
 * Request:
 *   POST /save_to_vault
 *   {
 *     run_id: string,
 *     include_attachments?: boolean,
 *     tags?: string[],
 *     notes?: string
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     vault_id: string,
 *     saved_at: string,
 *     summary: { verdict, score, key_factors }
 *   }
 */

// Static imports only - no dynamic imports allowed in Cloudflare Workers
import type { OpportunityObject, FinalVerdict, VaultPayload } from '../shared/OpportunityObject';
import { prepareForVault } from '../pass2_hub/orchestrator/Pass2Orchestrator';
import { prepareVaultPayload } from '../pass2_hub/spokes/Verdict';
import {
  getStagedOpportunity,
  updateRunStatus,
  saveToVault,
  writeLog,
  writeErrorLog,
  createResponse,
  ensureSerializable,
  TABLES,
} from '../shared/adapters/LovableAdapter';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface SaveToVaultRequest {
  run_id: string;
  include_attachments?: boolean;
  tags?: string[];
  notes?: string;
}

export interface SaveToVaultResponse {
  success: boolean;
  vault_id?: string;
  saved_at?: string;
  summary?: {
    zip: string;
    county: string;
    state: string;
    verdict: FinalVerdict['decision'];
    confidence: number;
    key_factors: string[];
    risks: string[];
    is_viable: boolean;
    cap_rate: number;
    roi_5yr: number;
  };
  error?: string;
  timestamp: number;
}

export interface VaultEntry {
  id: string;
  run_id: string;
  created_at: string;
  saved_at: string;
  tags: string[];
  notes: string | null;

  // Identity
  zip: string;
  state: string;
  county: string;
  county_fips: string;
  lat: number;
  lng: number;

  // Analysis toggles
  toggles: {
    urban_exclude: boolean;
    multifamily_priority: boolean;
    recreation_load: boolean;
    industrial_momentum: boolean;
    analysis_mode: string;
  };

  // Pass 1 summary
  pass1_summary: {
    macro_demand_sqft: number;
    macro_supply_sqft: number;
    supply_gap_sqft: number;
    competitor_count: number;
    hotspot_score: number;
    tier: string;
    recommendation: string;
  };

  // Pass 2 summary
  pass2_summary: {
    zoning_classification: string;
    permit_complexity: string;
    rent_10x10_cc: number;
    rent_10x10_std: number;
    fusion_demand_score: number;
    competitive_pressure_score: number;
    cap_rate: number;
    roi_5yr: number;
    dscr: number;
    is_viable: boolean;
  };

  // Final verdict
  verdict: {
    decision: string;
    confidence: number;
    key_factors: string[];
    risks: string[];
    recommendation: string;
    next_steps: string[];
  };

  // Full payload (JSON blob)
  full_payload: VaultPayload;
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

/**
 * Main handler for save_to_vault edge function
 * Compatible with Lovable.dev / Cloudflare Workers
 *
 * NOTE: This is the ONLY function that writes to Neon (permanent storage)
 */
export default async function handler(req: Request): Promise<Response> {
  try {
    // Parse request body
    const body = (await req.json()) as SaveToVaultRequest;

    // Validate required fields
    if (!body.run_id) {
      return Response.json(
        createResponse(false, undefined, 'run_id is required'),
        { status: 400 }
      );
    }

    // Log incoming request
    await writeLog('save_to_vault_started', {
      run_id: body.run_id,
      include_attachments: body.include_attachments,
      tags: body.tags,
    });

    // Get staged opportunity from DB
    const opportunity = await getStagedOpportunity<OpportunityObject>(body.run_id);

    if (!opportunity) {
      return Response.json(
        createResponse(false, undefined, 'Opportunity not found'),
        { status: 404 }
      );
    }

    // Check vault readiness
    const readiness = prepareForVault(opportunity);

    if (!readiness.ready) {
      return Response.json({
        success: false,
        error: `Not ready for vault: ${readiness.missing.join(', ')}`,
        timestamp: Date.now(),
      } as SaveToVaultResponse);
    }

    // Build vault entry
    const vaultEntry = buildVaultEntry(
      opportunity,
      body.run_id,
      body.tags || [],
      body.notes || null
    );

    // Save to permanent vault storage (Neon)
    const { vault_id } = await saveToVault(vaultEntry);

    // Update opportunity status
    opportunity.saved_to_vault_at = new Date().toISOString();
    opportunity.status = 'saved';

    // Update run status
    await updateRunStatus(TABLES.PASS2_RUNS, body.run_id, 'complete', {
      vault_id,
      saved_at: opportunity.saved_to_vault_at,
    });

    // Log completion
    await writeLog('save_to_vault_complete', {
      run_id: body.run_id,
      vault_id,
      verdict: opportunity.final_verdict?.decision,
    });

    // Build JSON-serializable response
    const response: SaveToVaultResponse = {
      success: true,
      vault_id,
      saved_at: opportunity.saved_to_vault_at,
      summary: {
        zip: opportunity.identity.zip,
        county: opportunity.identity.county,
        state: opportunity.identity.state,
        verdict: opportunity.final_verdict!.decision,
        confidence: opportunity.final_verdict!.confidence,
        key_factors: opportunity.final_verdict!.key_factors,
        risks: opportunity.final_verdict!.risks,
        is_viable: opportunity.pass2_results!.feasibility.is_viable,
        cap_rate: opportunity.pass2_results!.feasibility.cap_rate,
        roi_5yr: opportunity.pass2_results!.feasibility.roi_5yr,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('save_to_vault_exception', error instanceof Error ? error : errorMessage);

    return Response.json(
      createResponse(false, undefined, errorMessage),
      { status: 500 }
    );
  }
}

// ============================================================================
// VAULT ENTRY BUILDER
// ============================================================================

/**
 * Build vault entry from opportunity object
 */
function buildVaultEntry(
  opportunity: OpportunityObject,
  runId: string,
  tags: string[],
  notes: string | null
): VaultEntry {
  const { identity, toggles, pass1_macro, pass2_results, final_verdict } = opportunity;

  // Calculate supply gap
  const supplyGap = pass1_macro.macro_demand.demand_sqft - pass1_macro.macro_supply.total_supply_sqft;

  return {
    id: `vault_${runId}_${Date.now()}`,
    run_id: runId,
    created_at: opportunity.created_at,
    saved_at: new Date().toISOString(),
    tags,
    notes,

    // Identity
    zip: identity.zip,
    state: identity.state,
    county: identity.county,
    county_fips: identity.county_fips || '',
    lat: identity.lat,
    lng: identity.lng,

    // Toggles
    toggles: {
      urban_exclude: toggles.urban_exclude,
      multifamily_priority: toggles.multifamily_priority,
      recreation_load: toggles.recreation_load,
      industrial_momentum: toggles.industrial_momentum,
      analysis_mode: toggles.analysis_mode,
    },

    // Pass 1 summary
    pass1_summary: {
      macro_demand_sqft: pass1_macro.macro_demand.demand_sqft,
      macro_supply_sqft: pass1_macro.macro_supply.total_supply_sqft,
      supply_gap_sqft: supplyGap,
      competitor_count: pass1_macro.competitors.length,
      hotspot_score: pass1_macro.hotspot_score.overall_score,
      tier: pass1_macro.hotspot_score.tier,
      recommendation: opportunity.pass1_recommendation.recommendation,
    },

    // Pass 2 summary
    pass2_summary: {
      zoning_classification: pass2_results!.zoning_intel.classification,
      permit_complexity: pass2_results!.permit_intel.complexity,
      rent_10x10_cc: pass2_results!.rent_benchmarks.climate_control_10x10,
      rent_10x10_std: pass2_results!.rent_benchmarks.standard_10x10,
      fusion_demand_score: pass2_results!.fusion_demand.overall_score,
      competitive_pressure_score: pass2_results!.competitive_pressure.pressure_score,
      cap_rate: pass2_results!.feasibility.cap_rate,
      roi_5yr: pass2_results!.feasibility.roi_5yr,
      dscr: pass2_results!.feasibility.dscr,
      is_viable: pass2_results!.feasibility.is_viable,
    },

    // Final verdict
    verdict: {
      decision: final_verdict!.decision,
      confidence: final_verdict!.confidence,
      key_factors: final_verdict!.key_factors,
      risks: final_verdict!.risks,
      recommendation: final_verdict!.recommendation,
      next_steps: final_verdict!.next_steps || [],
    },

    // Full payload
    full_payload: ensureSerializable(prepareVaultPayload(opportunity)),
  };
}

// ============================================================================
// VAULT QUERY HELPERS
// ============================================================================

export interface VaultQueryOptions {
  state?: string;
  verdict?: 'PROCEED' | 'EVALUATE' | 'WALK';
  min_score?: number;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query saved opportunities from vault
 * Note: In production, this would query Neon directly
 */
export async function queryVault(options: VaultQueryOptions): Promise<{
  entries: VaultEntry[];
  total: number;
}> {
  await writeLog('vault_query', { options });

  // TODO: Implement Neon query
  // This would be a direct Neon query, not through @lovable/cloud-db
  // Since vault is permanent storage

  return {
    entries: [],
    total: 0,
  };
}

/**
 * Get single vault entry by ID
 */
export async function getVaultEntry(vaultId: string): Promise<VaultEntry | null> {
  await writeLog('vault_get', { vault_id: vaultId });

  // TODO: Implement Neon query
  return null;
}

/**
 * Delete vault entry (soft delete)
 */
export async function deleteVaultEntry(vaultId: string): Promise<{ success: boolean }> {
  await writeLog('vault_delete', { vault_id: vaultId });

  // TODO: Implement Neon soft delete
  return { success: false };
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleSaveToVault };
