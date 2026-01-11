/**
 * EDGE FUNCTION: start_pass3
 *
 * Lovable.dev compatible edge function for Pass 3 (Design/Calculator Hub) analysis
 * Performs detailed pro forma modeling and financial analysis.
 *
 * Request:
 *   POST /start_pass3
 *   {
 *     pass2_run_id: string,
 *     underwriting_package: UnderwritingPackage,
 *     land_asking_price?: number,
 *     override_assumptions?: FinancialAssumptions
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     run_id: string,
 *     status: 'pass3_complete',
 *     pro_forma: ProFormaPackage,
 *     recommendation: string
 *   }
 *
 * DRY_RUN mode:
 *   GET /start_pass3?dry_run=true to test with dummy data
 */

import { runPass3 } from '../pass3_hub/orchestrator/Pass3Orchestrator';
import {
  logPass3Failure,
  generateProcessId,
} from '../shared/failures/masterFailureLogger';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface FinancialAssumptions {
  vacancy_rate?: number;
  opex_ratio?: number;
  rent_growth?: number;
  interest_rate?: number;
  amortization_years?: number;
  target_ltv?: number;
  hold_period?: number;
  exit_cap_rate?: number;
}

export interface StartPass3Request {
  pass2_run_id: string;
  opportunity_id?: string;
  land_asking_price?: number;
  override_assumptions?: FinancialAssumptions;
}

export interface ProFormaSummary {
  total_project_cost: number;
  recommended_land_price: number;
  total_investment: number;
  equity_required: number;
  loan_amount: number;
  stabilized_noi: number;
  noi_per_acre_monthly: number;
  implied_cap_rate: number;
  levered_irr: number;
  unlevered_irr: number;
  equity_multiple: number;
  dscr: number;
  cost_per_sqft: number;
  dirt_work_pct: number;
}

export interface DoctrineCompliance {
  noi_minimum: { required: number; actual: number; passes: boolean };
  build_cost_max: { required: number; actual: number; passes: boolean };
  dirt_work_max: { required: number; actual: number; passes: boolean };
  dscr_minimum: { required: number; actual: number; passes: boolean };
  irr_minimum: { required: number; actual: number; passes: boolean };
  equity_multiple_min: { required: number; actual: number; passes: boolean };
  all_passing: boolean;
}

export interface StartPass3Response {
  success: boolean;
  mode?: 'normal' | 'dry-run';
  run_id?: string;
  process_id?: string;
  pass2_run_id?: string;
  status?: string;
  summary?: ProFormaSummary;
  doctrine_compliance?: DoctrineCompliance;
  recommendation?: {
    verdict: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'NEGOTIATE' | 'WALK';
    summary: string;
    key_risks: string[];
    negotiation_points: string[];
  };
  unit_mix?: {
    total_units: number;
    total_sqft: number;
    climate_controlled_pct: number;
    projected_gpr: number;
  };
  phasing?: {
    total_phases: number;
    phase1_units: number;
    months_to_stabilization: number;
  };
  fatal_flaws?: string[];
  warnings?: string[];
  error?: string;
  timestamp: number;
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

async function writeLog(event: string, data: Record<string, unknown>): Promise<void> {
  console.log(`[PASS3_DESIGN_HUB] ${event}:`, JSON.stringify(data));
}

async function writeErrorLog(event: string, error: string | Error, context?: Record<string, unknown>): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  console.error(`[PASS3_DESIGN_HUB] ${event}:`, errorMessage, context);
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
 * Main handler for start_pass3 edge function
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
    const body = (await req.json()) as StartPass3Request;

    // Validate required fields
    if (!body.pass2_run_id) {
      return Response.json(
        createResponse(false, undefined, 'pass2_run_id is required'),
        { status: 400 }
      );
    }

    // Log incoming request
    await writeLog('pass3_started', {
      process_id: processId,
      pass2_run_id: body.pass2_run_id,
      land_asking_price: body.land_asking_price,
      has_override_assumptions: !!body.override_assumptions,
    });

    // Run Pass 3 orchestrator
    const result = await runPass3({
      pass2RunId: body.pass2_run_id,
      opportunityId: body.opportunity_id,
      landAskingPrice: body.land_asking_price,
      overrideAssumptions: body.override_assumptions,
      processId,
    });

    if (!result.success) {
      await logPass3Failure(
        processId,
        'Orchestrator',
        'PASS3_ORCHESTRATOR_FAILURE',
        'error',
        result.error || 'Pass 3 orchestration failed',
        { pass2_run_id: body.pass2_run_id }
      );

      await writeErrorLog('pass3_failed', result.error || 'Unknown error', {
        process_id: processId,
        pass2_run_id: body.pass2_run_id,
      });

      return Response.json(
        createResponse(false, undefined, result.error || 'Pass 3 failed'),
        { status: 500 }
      );
    }

    // Log completion
    await writeLog('pass3_complete', {
      process_id: processId,
      run_id: result.runId,
      verdict: result.recommendation?.verdict,
      levered_irr: result.summary?.levered_irr,
      doctrine_compliant: result.doctrineCompliance?.all_passing,
    });

    // Build response
    const response: StartPass3Response = {
      success: true,
      mode: 'normal',
      run_id: result.runId,
      process_id: processId,
      pass2_run_id: body.pass2_run_id,
      status: 'pass3_complete',
      summary: result.summary,
      doctrine_compliance: result.doctrineCompliance,
      recommendation: result.recommendation,
      unit_mix: result.unitMix,
      phasing: result.phasing,
      fatal_flaws: result.fatalFlaws,
      warnings: result.warnings,
      timestamp: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await logPass3Failure(
      processId,
      'Orchestrator',
      'PASS3_EXCEPTION',
      'critical',
      errorMessage,
      { stack: error instanceof Error ? error.stack : undefined }
    );

    await writeErrorLog('pass3_exception', error instanceof Error ? error : errorMessage);

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
 * Handle dry-run mode for testing Pass 3
 */
async function handleDryRun(processId: string): Promise<Response> {
  await writeLog('pass3_dry_run_started', {
    process_id: processId,
    timestamp: Date.now(),
  });

  try {
    // Create dummy pro forma data
    const dryRunResponse: StartPass3Response = {
      success: true,
      mode: 'dry-run',
      run_id: `dry_run_pass3_${Date.now()}`,
      process_id: processId,
      pass2_run_id: 'dry_run_pass2',
      status: 'pass3_complete',
      summary: {
        total_project_cost: 2850000,
        recommended_land_price: 450000,
        total_investment: 3300000,
        equity_required: 1155000,
        loan_amount: 2145000,
        stabilized_noi: 312000,
        noi_per_acre_monthly: 6500,
        implied_cap_rate: 9.45,
        levered_irr: 18.5,
        unlevered_irr: 12.2,
        equity_multiple: 2.1,
        dscr: 1.45,
        cost_per_sqft: 22.50,
        dirt_work_pct: 8.5,
      },
      doctrine_compliance: {
        noi_minimum: { required: 5000, actual: 6500, passes: true },
        build_cost_max: { required: 27, actual: 22.50, passes: true },
        dirt_work_max: { required: 20, actual: 8.5, passes: true },
        dscr_minimum: { required: 1.25, actual: 1.45, passes: true },
        irr_minimum: { required: 12, actual: 18.5, passes: true },
        equity_multiple_min: { required: 1.5, actual: 2.1, passes: true },
        all_passing: true,
      },
      recommendation: {
        verdict: 'PROCEED',
        summary: 'Project meets all Barton Doctrine thresholds with strong returns.',
        key_risks: [
          'Market absorption assumptions',
          'Interest rate sensitivity',
        ],
        negotiation_points: [
          'Land price has 15% cushion below max',
          'Consider phased closing tied to absorption',
        ],
      },
      unit_mix: {
        total_units: 285,
        total_sqft: 42000,
        climate_controlled_pct: 35,
        projected_gpr: 38500,
      },
      phasing: {
        total_phases: 2,
        phase1_units: 120,
        months_to_stabilization: 18,
      },
      fatal_flaws: [],
      warnings: [
        'NOI marginally above $5,000/acre/month minimum',
      ],
      timestamp: Date.now(),
    };

    await writeLog('pass3_dry_run_complete', {
      process_id: processId,
      verdict: dryRunResponse.recommendation?.verdict,
      levered_irr: dryRunResponse.summary?.levered_irr,
      doctrine_compliant: dryRunResponse.doctrine_compliance?.all_passing,
    });

    return Response.json(dryRunResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await writeErrorLog('pass3_dry_run_exception', error instanceof Error ? error : errorMessage);

    return Response.json({
      success: false,
      mode: 'dry-run',
      process_id: processId,
      error: errorMessage,
      timestamp: Date.now(),
    } as StartPass3Response);
  }
}

// ============================================================================
// NAMED EXPORT FOR DIRECT IMPORT
// ============================================================================

export { handler as handleStartPass3 };
