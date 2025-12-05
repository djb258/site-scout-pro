/**
 * EDGE FUNCTION: trigger_calls
 *
 * Lovable.dev compatible edge function for triggering AI dialer calls
 *
 * Request:
 *   POST /trigger_calls
 *   {
 *     run_id: string,
 *     max_calls?: number (default 20),
 *     prioritize_by?: 'distance' | 'size' | 'pricing_gap'
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     batch_id: string,
 *     calls_triggered: number,
 *     estimated_duration_minutes: number
 *   }
 *
 * Webhook (POST /call_webhook):
 *   Receives AI dialer results and updates pricing data
 */

// Static imports only - no dynamic imports allowed in Cloudflare Workers
import type { CallSheetEntry, AiCallerPricing, OpportunityObject } from '../shared/opportunity_object';
import { triggerCalls } from '../pass1_hub/spokes/call_sheet';
import {
  createRun,
  updateRunStatus,
  getStagedOpportunity,
  getStagedResults,
  stageOpportunity,
  writeData,
  writeLog,
  writeErrorLog,
  createResponse,
  ensureSerializable,
  TABLES,
} from '../shared/lovable_adapter';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface TriggerCallsRequest {
  run_id: string;
  max_calls?: number;
  prioritize_by?: 'distance' | 'size' | 'pricing_gap';
}

export interface TriggerCallsResponse {
  success: boolean;
  batch_id?: string;
  calls_triggered?: number;
  calls_failed?: number;
  estimated_duration_minutes?: number;
  error?: string;
  timestamp: number;
}

export interface CallWebhookPayload {
  batch_id: string;
  call_id: string;
  facility_id: string;
  status: 'completed' | 'failed' | 'no_answer';
  transcript?: string;
  duration_seconds?: number;
  recording_url?: string;
  extracted_data?: {
    rates?: { unit_size: string; rate: number }[];
    availability?: { unit_size: string; available: boolean }[];
    admin_fee?: number;
  };
}

export interface CallWebhookResponse {
  success: boolean;
  pricing_updated: boolean;
  error?: string;
  timestamp: number;
}

// ============================================================================
// EDGE FUNCTION HANDLER - TRIGGER CALLS
// ============================================================================

/**
 * Main handler for trigger_calls edge function
 * Compatible with Lovable.dev / Cloudflare Workers
 */
export default async function handler(req: Request): Promise<Response> {
  try {
    // Parse request body
    const body = (await req.json()) as TriggerCallsRequest;

    // Validate required fields
    if (!body.run_id) {
      return Response.json(
        createResponse(false, undefined, 'run_id is required'),
        { status: 400 }
      );
    }

    const maxCalls = body.max_calls ?? 20;
    const prioritizeBy = body.prioritize_by ?? 'distance';

    // Log incoming request
    await writeLog('trigger_calls_started', {
      run_id: body.run_id,
      max_calls: maxCalls,
      prioritize_by: prioritizeBy,
    });

    // Get staged opportunity from DB
    const opportunity = await getStagedOpportunity<OpportunityObject>(body.run_id);

    if (!opportunity) {
      return Response.json(
        createResponse(false, undefined, 'Opportunity not found. Run Pass 1 and Local Scan first.'),
        { status: 404 }
      );
    }

    // Get call sheet from local scan results
    const localScan = await getStagedResults<{ call_sheet: CallSheetEntry[] }>(body.run_id, 'local_scan');
    const callSheet = localScan?.call_sheet || opportunity.local_scan?.call_sheet || [];

    if (callSheet.length === 0) {
      return Response.json(
        createResponse(false, undefined, 'No call sheet available. Run Local Scan first.'),
        { status: 400 }
      );
    }

    // Filter to pending calls only
    const pendingCalls = callSheet.filter((c) => c.call_status === 'pending');

    if (pendingCalls.length === 0) {
      return Response.json(
        createResponse(false, undefined, 'No pending calls in call sheet'),
        { status: 400 }
      );
    }

    // Limit to max_calls
    const callsToMake = pendingCalls.slice(0, maxCalls);

    // Create batch record in scratchpad
    const { id: batchId } = await createRun(TABLES.CALL_BATCHES, opportunity.identity.zip, {
      run_id: body.run_id,
      calls_count: callsToMake.length,
      prioritize_by: prioritizeBy,
    });

    // Update batch status to running
    await updateRunStatus(TABLES.CALL_BATCHES, batchId, 'running');

    // Trigger calls via AI dialer
    const result = await triggerCalls(callsToMake);

    // Estimate 3 minutes per call
    const estimatedDuration = callsToMake.length * 3;

    // Update batch status
    await updateRunStatus(TABLES.CALL_BATCHES, batchId, result.triggered > 0 ? 'running' : 'failed', {
      calls_triggered: result.triggered,
      calls_failed: result.failed,
      estimated_completion: Date.now() + estimatedDuration * 60 * 1000,
    });

    // Log completion
    await writeLog('trigger_calls_complete', {
      run_id: body.run_id,
      batch_id: batchId,
      calls_triggered: result.triggered,
      calls_failed: result.failed,
    });

    // Build JSON-serializable response
    const response: TriggerCallsResponse = {
      success: result.triggered > 0,
      batch_id: batchId,
      calls_triggered: result.triggered,
      calls_failed: result.failed,
      estimated_duration_minutes: estimatedDuration,
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('trigger_calls_exception', error instanceof Error ? error : errorMessage);

    return Response.json(
      createResponse(false, undefined, errorMessage),
      { status: 500 }
    );
  }
}

// ============================================================================
// WEBHOOK HANDLER - RECEIVE CALL RESULTS
// ============================================================================

/**
 * Webhook handler for AI dialer results
 * Compatible with Lovable.dev / Cloudflare Workers
 */
export async function handleCallWebhook(req: Request): Promise<Response> {
  try {
    // Parse webhook payload
    const payload = (await req.json()) as CallWebhookPayload;

    // Log incoming webhook
    await writeLog('call_webhook_received', {
      batch_id: payload.batch_id,
      call_id: payload.call_id,
      status: payload.status,
    });

    if (payload.status !== 'completed' || !payload.extracted_data) {
      await writeLog('call_webhook_skipped', {
        batch_id: payload.batch_id,
        call_id: payload.call_id,
        reason: 'Call not completed or no data extracted',
      });

      return Response.json({
        success: false,
        pricing_updated: false,
        error: 'Call did not complete successfully',
        timestamp: Date.now(),
      } as CallWebhookResponse);
    }

    // Transform webhook payload to AiCallerPricing format
    const pricingData: AiCallerPricing = {
      facility_id: payload.facility_id,
      facility_name: payload.facility_id, // Will be enriched later
      call_date: new Date().toISOString(),
      call_duration_seconds: payload.duration_seconds,
      call_recording_url: payload.recording_url,
      rates_collected: (payload.extracted_data.rates || []).map((r) => ({
        unit_size: r.unit_size,
        sqft: parseSqft(r.unit_size),
        climate_control: r.unit_size.toLowerCase().includes('cc'),
        advertised_rate: r.rate,
      })),
      availability: (payload.extracted_data.availability || []).map((a) => ({
        unit_size: a.unit_size,
        available: a.available,
      })),
      admin_fee: payload.extracted_data.admin_fee,
      confidence_level: 'high',
    };

    // Write pricing data to scratchpad
    await writeData(TABLES.RATE_OBSERVATIONS, {
      batch_id: payload.batch_id,
      call_id: payload.call_id,
      facility_id: payload.facility_id,
      pricing_data: pricingData,
      transcript: payload.transcript,
    });

    // Log successful pricing update
    await writeLog('pricing_updated', {
      batch_id: payload.batch_id,
      call_id: payload.call_id,
      facility_id: payload.facility_id,
      rates_count: pricingData.rates_collected.length,
    });

    return Response.json({
      success: true,
      pricing_updated: true,
      timestamp: Date.now(),
    } as CallWebhookResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('call_webhook_exception', error instanceof Error ? error : errorMessage);

    return Response.json(
      {
        success: false,
        pricing_updated: false,
        error: errorMessage,
        timestamp: Date.now(),
      } as CallWebhookResponse,
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse unit size string to square footage
 */
function parseSqft(unitSize: string): number {
  const match = unitSize.match(/(\d+)x(\d+)/i);
  if (match) {
    return parseInt(match[1]) * parseInt(match[2]);
  }
  return 0;
}

// ============================================================================
// NAMED EXPORTS
// ============================================================================

export { handler as handleTriggerCalls };
