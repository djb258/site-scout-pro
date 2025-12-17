/**
 * EDGE FUNCTION: start_pass15
 *
 * Lovable.dev compatible edge function for Pass 1.5 (Rent Recon Hub) analysis
 * Collects and verifies rate evidence before underwriting.
 *
 * Request:
 *   POST /start_pass15
 *   {
 *     pass1_run_id: string,
 *     competitors?: Competitor[],
 *     scrape_websites?: boolean,
 *     make_ai_calls?: boolean,
 *     max_concurrent_calls?: number
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     run_id: string,
 *     status: 'pass15_complete',
 *     rate_evidence: RateEvidencePackage,
 *     coverage_score: number,
 *     confidence_level: string,
 *     promotion_decision: string
 *   }
 *
 * DRY_RUN mode:
 *   GET /start_pass15?dry_run=true to test with dummy data
 */

import { runPass15 } from '../pass15_hub/orchestrator/Pass15Orchestrator';
import {
  logPass15Failure,
  generateProcessId,
} from '../shared/failures/masterFailureLogger';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface Competitor {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  distance_miles: number;
  estimated_sqft?: number;
}

export interface StartPass15Request {
  pass1_run_id: string;
  zip_code?: string;
  competitors?: Competitor[];
  scrape_websites?: boolean;
  make_ai_calls?: boolean;
  max_concurrent_calls?: number;
}

export interface RateEvidence {
  source: 'scrape' | 'ai_call' | 'manual';
  facility_name: string;
  unit_size: string;
  sqft: number;
  monthly_rate: number;
  climate_controlled: boolean;
  confidence: 'high' | 'medium' | 'low';
  collected_at: string;
}

export interface StartPass15Response {
  success: boolean;
  mode?: 'normal' | 'dry-run';
  run_id?: string;
  process_id?: string;
  pass1_run_id?: string;
  status?: string;
  rate_evidence?: {
    rates: RateEvidence[];
    normalized_rates: Record<string, { avg: number; min: number; max: number }>;
    market_benchmarks: {
      avg_rent_per_sqft: number;
      climate_premium_pct: number;
    };
  };
  coverage_score?: number;
  confidence_level?: 'high' | 'medium' | 'low';
  promotion_decision?: 'PROMOTE' | 'HOLD' | 'INSUFFICIENT_DATA';
  stats?: {
    competitors_scraped: number;
    competitors_called: number;
    rates_collected: number;
    coverage_pct: number;
  };
  error?: string;
  timestamp: number;
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

async function writeLog(event: string, data: Record<string, unknown>): Promise<void> {
  console.log(`[PASS15_RENT_RECON_HUB] ${event}:`, JSON.stringify(data));
}

async function writeErrorLog(event: string, error: string | Error, context?: Record<string, unknown>): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  console.error(`[PASS15_RENT_RECON_HUB] ${event}:`, errorMessage, context);
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
 * Main handler for start_pass15 edge function
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
    const body = (await req.json()) as StartPass15Request;

    // Validate required fields
    if (!body.pass1_run_id) {
      return Response.json(
        createResponse(false, undefined, 'pass1_run_id is required'),
        { status: 400 }
      );
    }

    // Log incoming request
    await writeLog('pass15_started', {
      process_id: processId,
      pass1_run_id: body.pass1_run_id,
      scrape_websites: body.scrape_websites ?? true,
      make_ai_calls: body.make_ai_calls ?? true,
      competitor_count: body.competitors?.length ?? 0,
    });

    // Run Pass 1.5 orchestrator
    const result = await runPass15({
      pass1RunId: body.pass1_run_id,
      zipCode: body.zip_code,
      competitors: body.competitors,
      scrapeWebsites: body.scrape_websites ?? true,
      makeAiCalls: body.make_ai_calls ?? true,
      maxConcurrentCalls: body.max_concurrent_calls ?? 20,
      processId,
    });

    if (!result.success) {
      await logPass15Failure(
        processId,
        'Orchestrator',
        'PASS15_ORCHESTRATOR_FAILURE',
        'error',
        result.error || 'Pass 1.5 orchestration failed',
        { pass1_run_id: body.pass1_run_id }
      );

      await writeErrorLog('pass15_failed', result.error || 'Unknown error', {
        process_id: processId,
        pass1_run_id: body.pass1_run_id,
      });

      return Response.json(
        createResponse(false, undefined, result.error || 'Pass 1.5 failed'),
        { status: 500 }
      );
    }

    // Log completion
    await writeLog('pass15_complete', {
      process_id: processId,
      run_id: result.runId,
      coverage_score: result.coverageScore,
      confidence_level: result.confidenceLevel,
      promotion_decision: result.promotionDecision,
    });

    // Build response
    const response: StartPass15Response = {
      success: true,
      mode: 'normal',
      run_id: result.runId,
      process_id: processId,
      pass1_run_id: body.pass1_run_id,
      status: 'pass15_complete',
      rate_evidence: result.rateEvidence,
      coverage_score: result.coverageScore,
      confidence_level: result.confidenceLevel,
      promotion_decision: result.promotionDecision,
      stats: result.stats,
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await logPass15Failure(
      processId,
      'Orchestrator',
      'PASS15_EXCEPTION',
      'critical',
      errorMessage,
      { stack: error instanceof Error ? error.stack : undefined }
    );

    await writeErrorLog('pass15_exception', error instanceof Error ? error : errorMessage);

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
 * Handle dry-run mode for testing Pass 1.5
 */
async function handleDryRun(processId: string): Promise<Response> {
  await writeLog('pass15_dry_run_started', {
    process_id: processId,
    timestamp: Date.now(),
  });

  try {
    // Create dummy rate evidence
    const dryRunResponse: StartPass15Response = {
      success: true,
      mode: 'dry-run',
      run_id: `dry_run_pass15_${Date.now()}`,
      process_id: processId,
      pass1_run_id: 'dry_run_pass1',
      status: 'pass15_complete',
      rate_evidence: {
        rates: [
          {
            source: 'ai_call',
            facility_name: 'Test Storage A',
            unit_size: '10x10',
            sqft: 100,
            monthly_rate: 125,
            climate_controlled: false,
            confidence: 'high',
            collected_at: new Date().toISOString(),
          },
          {
            source: 'scrape',
            facility_name: 'Test Storage B',
            unit_size: '10x10',
            sqft: 100,
            monthly_rate: 135,
            climate_controlled: false,
            confidence: 'medium',
            collected_at: new Date().toISOString(),
          },
          {
            source: 'ai_call',
            facility_name: 'Test Storage A',
            unit_size: '10x10',
            sqft: 100,
            monthly_rate: 165,
            climate_controlled: true,
            confidence: 'high',
            collected_at: new Date().toISOString(),
          },
        ],
        normalized_rates: {
          '5x5': { avg: 75, min: 65, max: 85 },
          '5x10': { avg: 95, min: 85, max: 110 },
          '10x10': { avg: 130, min: 125, max: 145 },
          '10x15': { avg: 175, min: 160, max: 195 },
          '10x20': { avg: 225, min: 200, max: 250 },
          '10x30': { avg: 295, min: 275, max: 325 },
        },
        market_benchmarks: {
          avg_rent_per_sqft: 1.35,
          climate_premium_pct: 25,
        },
      },
      coverage_score: 78,
      confidence_level: 'medium',
      promotion_decision: 'PROMOTE',
      stats: {
        competitors_scraped: 5,
        competitors_called: 8,
        rates_collected: 24,
        coverage_pct: 78,
      },
      timestamp: Date.now(),
    };

    await writeLog('pass15_dry_run_complete', {
      process_id: processId,
      coverage_score: dryRunResponse.coverage_score,
      confidence_level: dryRunResponse.confidence_level,
      promotion_decision: dryRunResponse.promotion_decision,
    });

    return Response.json(dryRunResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass15_dry_run_exception', error instanceof Error ? error : errorMessage);

    return Response.json({
      success: false,
      mode: 'dry-run',
      process_id: processId,
      error: errorMessage,
      timestamp: Date.now(),
    } as StartPass15Response);
  }
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleStartPass15 };
