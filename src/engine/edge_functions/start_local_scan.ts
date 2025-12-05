/**
 * EDGE FUNCTION: start_local_scan
 *
 * Lovable.dev compatible edge function for Local Scan
 * Called after Pass 1 when user adjusts radius slider (5-30 miles)
 *
 * Request:
 *   POST /start_local_scan
 *   {
 *     run_id: string,
 *     radius_miles: number (5-30),
 *     include_pricing?: boolean,
 *     generate_call_sheet?: boolean
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     local_scan_results: LocalScanResults,
 *     call_sheet: CallSheetEntry[],
 *     pricing_readiness: { total, verified, needed, pct }
 *   }
 */

// Static imports only - no dynamic imports allowed in Cloudflare Workers
import type { LocalScanResults, CallSheetEntry, OpportunityObject } from '../shared/opportunity_object';
import { runLocalScan, checkPricingReadiness } from '../pass1_hub/spokes/local_scan';
import { generateCallSheet } from '../pass1_hub/spokes/call_sheet';
import {
  updateRunStatus,
  getStagedOpportunity,
  stageOpportunity,
  stageResults,
  writeLog,
  writeErrorLog,
  createResponse,
  ensureSerializable,
  TABLES,
} from '../shared/lovable_adapter';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface StartLocalScanRequest {
  run_id: string;
  radius_miles: number;
  include_pricing?: boolean;
  generate_call_sheet?: boolean;
}

export interface StartLocalScanResponse {
  success: boolean;
  run_id?: string;
  local_scan_results?: LocalScanResults;
  call_sheet?: CallSheetEntry[];
  pricing_readiness?: {
    total_facilities: number;
    pricing_verified: number;
    pricing_needed: number;
    readiness_pct: number;
    ready_for_pass2: boolean;
  };
  error?: string;
  timestamp: number;
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

/**
 * Main handler for start_local_scan edge function
 * Compatible with Lovable.dev / Cloudflare Workers
 */
export default async function handler(req: Request): Promise<Response> {
  try {
    // Parse request body
    const body = (await req.json()) as StartLocalScanRequest;

    // Validate required fields
    if (!body.run_id) {
      return Response.json(
        createResponse(false, undefined, 'run_id is required'),
        { status: 400 }
      );
    }

    // Validate radius
    if (body.radius_miles < 5 || body.radius_miles > 30) {
      return Response.json(
        createResponse(false, undefined, 'Radius must be between 5 and 30 miles'),
        { status: 400 }
      );
    }

    // Log incoming request
    await writeLog('local_scan_started', {
      run_id: body.run_id,
      radius_miles: body.radius_miles,
      include_pricing: body.include_pricing,
      generate_call_sheet: body.generate_call_sheet,
    });

    // Get staged opportunity from Pass 1
    const opportunity = await getStagedOpportunity<OpportunityObject>(body.run_id);

    if (!opportunity) {
      return Response.json(
        createResponse(false, undefined, 'Opportunity not found. Run Pass 1 first.'),
        { status: 404 }
      );
    }

    // Update run status
    await updateRunStatus(TABLES.LOCAL_SCAN_RUNS, body.run_id, 'running', {
      radius_miles: body.radius_miles,
    });

    // Run local scan
    const localScanResults = await runLocalScan({
      lat: opportunity.identity.lat,
      lng: opportunity.identity.lng,
      radius_miles: body.radius_miles,
      include_pricing: body.include_pricing ?? true,
      generate_call_sheet: body.generate_call_sheet ?? true,
    });

    // Generate call sheet if requested
    let callSheet: CallSheetEntry[] = [];
    if (body.generate_call_sheet) {
      const callSheetOutput = generateCallSheet({
        competitors: localScanResults.local_competitors,
        prioritize_by: 'distance',
      });
      callSheet = callSheetOutput.call_sheet;
      localScanResults.call_sheet = callSheet;
    }

    // Check pricing readiness
    const pricingReadiness = checkPricingReadiness(localScanResults.local_competitors);

    // Update opportunity object with local scan results
    opportunity.local_scan = localScanResults;
    opportunity.local_scan_completed_at = new Date().toISOString();
    opportunity.status = 'local_scan_complete';
    opportunity.pass2_prerequisites.has_competitor_list = true;
    opportunity.pass2_prerequisites.has_pricing_data = pricingReadiness.ready_for_pass2;

    // Stage updated opportunity back to DB
    await stageOpportunity(body.run_id, opportunity);

    // Stage local scan results separately for quick access
    await stageResults(body.run_id, 'local_scan', localScanResults);

    // Update run status to complete
    await updateRunStatus(TABLES.LOCAL_SCAN_RUNS, body.run_id, 'complete', {
      competitors_found: localScanResults.local_competitors.length,
      pricing_readiness_pct: pricingReadiness.readiness_pct,
    });

    // Log completion
    await writeLog('local_scan_complete', {
      run_id: body.run_id,
      radius_miles: body.radius_miles,
      competitors_found: localScanResults.local_competitors.length,
      calls_needed: callSheet.filter((c) => c.call_status === 'pending').length,
    });

    // Build JSON-serializable response
    const response: StartLocalScanResponse = {
      success: true,
      run_id: body.run_id,
      local_scan_results: ensureSerializable(localScanResults),
      call_sheet: ensureSerializable(callSheet),
      pricing_readiness: {
        total_facilities: pricingReadiness.total_facilities,
        pricing_verified: pricingReadiness.pricing_verified,
        pricing_needed: pricingReadiness.pricing_needed,
        readiness_pct: pricingReadiness.readiness_pct,
        ready_for_pass2: pricingReadiness.ready_for_pass2,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('local_scan_exception', error instanceof Error ? error : errorMessage);

    return Response.json(
      createResponse(false, undefined, errorMessage),
      { status: 500 }
    );
  }
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleStartLocalScan };
