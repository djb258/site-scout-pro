/**
 * Pass5Orchestrator.ts - SubHub5_DealGate
 *
 * Doctrine ID: SS.05.00
 * Purpose: Doctrine enforcement and final Go/No-Go verdict
 * Anchor: SVA + Parcel ID
 * Constraint: BINARY_OUTPUT (GOOD_DEAL | BAD_DEAL only)
 *
 * Spokes: GateEvaluator, DoctrineEnforcer, VerdictCompiler
 */

import { runGateEvaluator, GateEvaluatorInput } from '../spokes/GateEvaluator';
import { runDoctrineEnforcer, DoctrineEnforcerInput } from '../spokes/DoctrineEnforcer';
import { runVerdictCompiler, VerdictCompilerInput } from '../spokes/VerdictCompiler';
import {
  Pass5Input,
  Pass5Output,
  GateEvaluatorResult,
  DoctrineEnforcerResult,
  VerdictCompilerResult,
  DealVerdictOutput,
  createStubGateEvaluator,
  createStubDoctrineEnforcer,
  createStubVerdictCompiler,
} from '../types/pass5_types';

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class Pass5Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = `P5-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute SubHub5_DealGate
   *
   * Order: GateEvaluator → DoctrineEnforcer → VerdictCompiler
   *
   * CONSTRAINT: BINARY_OUTPUT - Final verdict is GOOD_DEAL or BAD_DEAL only
   */
  async run(input: Pass5Input): Promise<Pass5Output> {
    console.log(`[SUBHUB5_DEAL_GATE] Starting run ${this.runId}`);
    console.log(`[SUBHUB5_DEAL_GATE] SVA Anchor: ${input.svaId}`);
    console.log(`[SUBHUB5_DEAL_GATE] Parcel Anchor: ${input.parcelId}`);
    const startTime = Date.now();

    let gateEvaluator: GateEvaluatorResult = createStubGateEvaluator();
    let doctrineEnforcer: DoctrineEnforcerResult = createStubDoctrineEnforcer();
    let verdictCompiler: VerdictCompilerResult = createStubVerdictCompiler();

    // ========================================================================
    // SPOKE 1: GateEvaluator (SS.05.01)
    // ========================================================================
    try {
      console.log(`[SUBHUB5_DEAL_GATE] Running GateEvaluator spoke...`);

      const gateInput: GateEvaluatorInput = {
        svaId: input.svaId,
        parcelId: input.parcelId,
        // TODO: Wire up actual data from upstream SubHubs
        // For now, using placeholder data
        marketData: {
          hotspotScore: 65,
          tier: 'B',
        },
        rulesData: {
          constraintsPassed: ['zoning', 'setbacks', 'coverage'],
          constraintsFailed: [],
          zoningCompatible: true,
        },
        feasibilityData: {
          projectedIRR: 0.18,
          projectedNOI: 150000,
          maxLandPrice: 500000,
        },
        parcelData: {
          dataQualityScore: 75,
          promotionValid: true,
        },
        thresholds: input.gateConfig,
        skipGates: input.skipGates,
      };

      gateEvaluator = await runGateEvaluator(gateInput);

      if (gateEvaluator.status === 'error') {
        this.errors.push(`GateEvaluator: ${gateEvaluator.notes}`);
      }
    } catch (err) {
      this.errors.push(`GateEvaluator failed: ${err}`);
      console.error(`[SUBHUB5_DEAL_GATE] GateEvaluator error:`, err);
    }

    // ========================================================================
    // SPOKE 2: DoctrineEnforcer (SS.05.02)
    // ========================================================================
    try {
      console.log(`[SUBHUB5_DEAL_GATE] Running DoctrineEnforcer spoke...`);

      const doctrineInput: DoctrineEnforcerInput = {
        svaId: input.svaId,
        parcelId: input.parcelId,
        pipelineStatus: {
          subhub0Complete: !!input.subhub0RunId,
          subhub1Complete: !!input.subhub1RunId,
          subhub2Complete: !!input.subhub2RunId,
          subhub3Complete: !!input.subhub3RunId,
          subhub4Complete: !!input.subhub4RunId,
        },
        dataIntegrity: {
          parcelZipMatchesSearch: true, // TODO: Validate from actual data
          parcelFipsMatchesJurisdiction: true,
          svaHasValidIntent: input.svaId.startsWith('SVA-'),
        },
      };

      doctrineEnforcer = await runDoctrineEnforcer(doctrineInput);

      if (doctrineEnforcer.status === 'error') {
        this.errors.push(`DoctrineEnforcer: ${doctrineEnforcer.notes}`);
      }
    } catch (err) {
      this.errors.push(`DoctrineEnforcer failed: ${err}`);
      console.error(`[SUBHUB5_DEAL_GATE] DoctrineEnforcer error:`, err);
    }

    // ========================================================================
    // SPOKE 3: VerdictCompiler (SS.05.03)
    // ========================================================================
    try {
      console.log(`[SUBHUB5_DEAL_GATE] Running VerdictCompiler spoke...`);

      const verdictInput: VerdictCompilerInput = {
        svaId: input.svaId,
        parcelId: input.parcelId,
        gateResults: gateEvaluator,
        doctrineResults: doctrineEnforcer,
        strictMode: true,
      };

      verdictCompiler = await runVerdictCompiler(verdictInput);

      if (verdictCompiler.status === 'error') {
        this.errors.push(`VerdictCompiler: ${verdictCompiler.notes}`);
      }
    } catch (err) {
      this.errors.push(`VerdictCompiler failed: ${err}`);
      console.error(`[SUBHUB5_DEAL_GATE] VerdictCompiler error:`, err);
    }

    // ========================================================================
    // ASSEMBLE FINAL VERDICT
    // ========================================================================
    const elapsed = Date.now() - startTime;
    console.log(`[SUBHUB5_DEAL_GATE] Run ${this.runId} completed in ${elapsed}ms`);
    console.log(`[SUBHUB5_DEAL_GATE] VERDICT: ${verdictCompiler.verdict}`);

    const finalVerdict: DealVerdictOutput = {
      sva: input.svaId,
      parcelId: input.parcelId,
      verdict: verdictCompiler.verdict,
      gatesPassed: verdictCompiler.gatesSummary.passed,
      gatesFailed: verdictCompiler.gatesSummary.failed,
      timestamp: verdictCompiler.timestamp,
      confidence: verdictCompiler.confidence,
      summary: generateSummary(verdictCompiler, doctrineEnforcer),
    };

    const output: Pass5Output = {
      success: this.errors.length === 0 && verdictCompiler.status === 'ok',
      runId: this.runId,
      timestamp: Date.now(),
      svaId: input.svaId,
      parcelId: input.parcelId,
      gateEvaluator,
      doctrineEnforcer,
      verdictCompiler,
      finalVerdict,
      error: this.errors.length > 0 ? this.errors.join('; ') : undefined,
    };

    return JSON.parse(JSON.stringify(output));
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSummary(
  verdict: VerdictCompilerResult,
  doctrine: DoctrineEnforcerResult
): string {
  const parts: string[] = [];

  parts.push(`Verdict: ${verdict.verdict}`);
  parts.push(`Confidence: ${verdict.confidence}`);
  parts.push(`Gates: ${verdict.gatesSummary.passed.length} passed, ${verdict.gatesSummary.failed.length} failed`);

  if (!doctrine.compliant) {
    parts.push(`Doctrine violations: ${doctrine.hardViolations} hard, ${doctrine.softViolations} soft`);
  } else {
    parts.push('Doctrine: Compliant');
  }

  return parts.join(' | ');
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function runPass5(input: Pass5Input): Promise<Pass5Output> {
  const orchestrator = new Pass5Orchestrator();
  return orchestrator.run(input);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Pass5Orchestrator;
