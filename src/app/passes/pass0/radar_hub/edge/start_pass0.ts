/**
 * EDGE FUNCTION: start_pass0
 *
 * Lovable.dev compatible edge function for Pass 0 (Radar Hub) analysis
 * Aggregates momentum signals before site-specific analysis begins.
 *
 * Request:
 *   POST /start_pass0
 *   {
 *     zip_code: string,
 *     state: string
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     run_id: string,
 *     status: 'pass0_complete',
 *     momentum_score: number,
 *     confidence_level: string,
 *     trend_direction: string,
 *     top_contributors: string[]
 *   }
 *
 * DRY_RUN mode:
 *   GET /start_pass0?dry_run=true to test with dummy data
 */

import { runPass0 } from '../pass0_hub/orchestrator/Pass0Orchestrator';
import {
  logPass0Failure,
  generateProcessId,
} from '../shared/failures/masterFailureLogger';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface StartPass0Request {
  zip_code: string;
  state: string;
}

export interface StartPass0Response {
  success: boolean;
  mode?: 'normal' | 'dry-run';
  run_id?: string;
  process_id?: string;
  status?: string;
  momentum_score?: number;
  confidence_level?: 'high' | 'medium' | 'low';
  trend_direction?: 'rising' | 'stable' | 'declining';
  top_contributors?: string[];
  signals?: {
    trend_signal?: number;
    permit_activity?: number;
    news_events?: number;
    industrial_logistics?: number;
    housing_pipeline?: number;
  };
  error?: string;
  timestamp: number;
}

// ============================================================================
// LOGGING HELPERS (Supabase-compatible)
// ============================================================================

async function writeLog(event: string, data: Record<string, unknown>): Promise<void> {
  console.log(`[PASS0_RADAR_HUB] ${event}:`, JSON.stringify(data));
}

async function writeErrorLog(event: string, error: string | Error, context?: Record<string, unknown>): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  console.error(`[PASS0_RADAR_HUB] ${event}:`, errorMessage, context);
}

function createResponse(success: boolean, data?: unknown, error?: string): Record<string, unknown> {
  return {
    success,
    ...(data ? { data } : {}),
    ...(error ? { error } : {}),
    timestamp: Date.now(),
  };
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

/**
 * Main handler for start_pass0 edge function
 * Compatible with Lovable.dev / Cloudflare Workers
 */
export default async function handler(req: Request): Promise<Response> {
  const processId = generateProcessId();

  try {
    // Check for DRY_RUN mode
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dry_run') === 'true';

    if (isDryRun) {
      return handleDryRun(processId);
    }

    // Parse request body
    const body = (await req.json()) as StartPass0Request;

    // Validate required fields
    if (!body.zip_code) {
      return Response.json(
        createResponse(false, undefined, 'zip_code is required'),
        { status: 400 }
      );
    }

    if (!body.state) {
      return Response.json(
        createResponse(false, undefined, 'state is required'),
        { status: 400 }
      );
    }

    // Log incoming request
    await writeLog('pass0_started', {
      process_id: processId,
      zip_code: body.zip_code,
      state: body.state,
    });

    // Run Pass 0 orchestrator
    const result = await runPass0({
      zipCode: body.zip_code,
      state: body.state,
      processId,
    });

    if (!result.success) {
      await logPass0Failure(
        processId,
        'Orchestrator',
        'PASS0_ORCHESTRATOR_FAILURE',
        'error',
        result.error || 'Pass 0 orchestration failed',
        { zip_code: body.zip_code, state: body.state }
      );

      await writeErrorLog('pass0_failed', result.error || 'Unknown error', {
        process_id: processId,
        zip_code: body.zip_code,
      });

      return Response.json(
        createResponse(false, undefined, result.error || 'Pass 0 failed'),
        { status: 500 }
      );
    }

    // Log completion
    await writeLog('pass0_complete', {
      process_id: processId,
      run_id: result.runId,
      momentum_score: result.momentumScore,
      confidence_level: result.confidenceLevel,
    });

    // Build response
    const response: StartPass0Response = {
      success: true,
      mode: 'normal',
      run_id: result.runId,
      process_id: processId,
      status: 'pass0_complete',
      momentum_score: result.momentumScore,
      confidence_level: result.confidenceLevel,
      trend_direction: result.trendDirection,
      top_contributors: result.topContributors,
      signals: result.signals,
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await logPass0Failure(
      processId,
      'Orchestrator',
      'PASS0_EXCEPTION',
      'critical',
      errorMessage,
      { stack: error instanceof Error ? error.stack : undefined }
    );

    await writeErrorLog('pass0_exception', error instanceof Error ? error : errorMessage);

    return Response.json(
      createResponse(false, undefined, errorMessage),
      { status: 500 }
    );
  }
}

// ============================================================================
// DRY RUN HANDLER
// ============================================================================

/**
 * Handle dry-run mode for testing Pass 0
 */
async function handleDryRun(processId: string): Promise<Response> {
  await writeLog('pass0_dry_run_started', {
    process_id: processId,
    timestamp: Date.now(),
  });

  try {
    // Create dummy momentum data
    const dryRunResponse: StartPass0Response = {
      success: true,
      mode: 'dry-run',
      run_id: `dry_run_pass0_${Date.now()}`,
      process_id: processId,
      status: 'pass0_complete',
      momentum_score: 72,
      confidence_level: 'medium',
      trend_direction: 'rising',
      top_contributors: ['IndustrialLogistics', 'PermitActivity', 'NewsEvents'],
      signals: {
        trend_signal: 68,
        permit_activity: 75,
        news_events: 70,
        industrial_logistics: 78,
        housing_pipeline: 65,
      },
      timestamp: Date.now(),
    };

    await writeLog('pass0_dry_run_complete', {
      process_id: processId,
      momentum_score: dryRunResponse.momentum_score,
      confidence_level: dryRunResponse.confidence_level,
    });

    return Response.json(dryRunResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass0_dry_run_exception', error instanceof Error ? error : errorMessage);

    return Response.json({
      success: false,
      mode: 'dry-run',
      process_id: processId,
      error: errorMessage,
      timestamp: Date.now(),
    } as StartPass0Response);
  }
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleStartPass0 };
