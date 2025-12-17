// Pass0Orchestrator.ts - PASS 0 — RADAR HUB (Variables)
// Doctrine ID: SS.00.00
// Purpose: Aggregates momentum signals before site-specific analysis
// Spokes: TrendSignal, PermitActivity, NewsEvents, IndustrialLogistics, HousingPipeline, MomentumFusion

import { runTrendSignal } from '../spokes/TrendSignal';
import { runPermitActivity } from '../spokes/PermitActivity';
import { runNewsEvents } from '../spokes/NewsEvents';
import { runIndustrialLogistics } from '../spokes/IndustrialLogistics';
import { runHousingPipeline } from '../spokes/HousingPipeline';
import { runMomentumFusion } from '../spokes/MomentumFusion';

// ============================================================================
// TYPES
// ============================================================================

export interface Pass0Input {
  targetZip: string;
  targetState: string;
  msaCode?: string;
  lookbackMonths?: number;
}

export interface Pass0Output {
  pass: 'PASS0';
  runId: string;
  timestamp: string;
  input: Pass0Input;
  trendSignal: TrendSignalOutput | null;
  permitActivity: PermitActivityOutput | null;
  newsEvents: NewsEventsOutput | null;
  industrialLogistics: IndustrialLogisticsOutput | null;
  housingPipeline: HousingPipelineOutput | null;
  momentumFusion: MomentumFusionOutput | null;
  aggregatedMomentumScore: number;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

// Spoke output types (placeholder shapes)
export interface TrendSignalOutput {
  spokeId: 'SS.00.01';
  googleTrendsIndex: number | null;
  searchVolumeGrowth: number | null;
  timestamp: string;
}

export interface PermitActivityOutput {
  spokeId: 'SS.00.02';
  commercialPermits: number;
  residentialPermits: number;
  permitGrowthRate: number | null;
  timestamp: string;
}

export interface NewsEventsOutput {
  spokeId: 'SS.00.03';
  majorEmployerAnnouncements: string[];
  infrastructureProjects: string[];
  sentimentScore: number | null;
  timestamp: string;
}

export interface IndustrialLogisticsOutput {
  spokeId: 'SS.00.04';
  warehouseVacancyRate: number | null;
  newLogisticsFacilities: number;
  freightVolumeIndex: number | null;
  timestamp: string;
}

export interface HousingPipelineOutput {
  spokeId: 'SS.00.05';
  multifamilyUnitsPermitted: number;
  singleFamilyStarts: number;
  housingSupplyPressure: 'high' | 'medium' | 'low' | null;
  timestamp: string;
}

export interface MomentumFusionOutput {
  spokeId: 'SS.00.06';
  fusedMomentumScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  topContributors: string[];
  timestamp: string;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export class Pass0Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = `P0-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Executes Pass-0 Momentum Hub
   * Order: TrendSignal → PermitActivity → NewsEvents → IndustrialLogistics → HousingPipeline → MomentumFusion
   */
  async run(input: Pass0Input): Promise<Pass0Output> {
    console.log(`[PASS0_MOMENTUM_HUB] Starting run ${this.runId}`);
    const startTime = Date.now();

    let trendSignal: TrendSignalOutput | null = null;
    let permitActivity: PermitActivityOutput | null = null;
    let newsEvents: NewsEventsOutput | null = null;
    let industrialLogistics: IndustrialLogisticsOutput | null = null;
    let housingPipeline: HousingPipelineOutput | null = null;
    let momentumFusion: MomentumFusionOutput | null = null;

    // ========================================================================
    // SPOKE 1: TrendSignal (SS.00.01)
    // ========================================================================
    try {
      console.log(`[PASS0_MOMENTUM_HUB] Running TrendSignal spoke...`);
      trendSignal = await runTrendSignal({
        zip: input.targetZip,
        state: input.targetState,
      });
    } catch (err) {
      this.errors.push(`TrendSignal failed: ${err}`);
      console.error(`[PASS0_MOMENTUM_HUB] TrendSignal error:`, err);
    }

    // ========================================================================
    // SPOKE 2: PermitActivity (SS.00.02)
    // ========================================================================
    try {
      console.log(`[PASS0_MOMENTUM_HUB] Running PermitActivity spoke...`);
      permitActivity = await runPermitActivity({
        zip: input.targetZip,
        state: input.targetState,
        lookbackMonths: input.lookbackMonths ?? 12,
      });
    } catch (err) {
      this.errors.push(`PermitActivity failed: ${err}`);
      console.error(`[PASS0_MOMENTUM_HUB] PermitActivity error:`, err);
    }

    // ========================================================================
    // SPOKE 3: NewsEvents (SS.00.03)
    // ========================================================================
    try {
      console.log(`[PASS0_MOMENTUM_HUB] Running NewsEvents spoke...`);
      newsEvents = await runNewsEvents({
        zip: input.targetZip,
        state: input.targetState,
        msaCode: input.msaCode,
      });
    } catch (err) {
      this.errors.push(`NewsEvents failed: ${err}`);
      console.error(`[PASS0_MOMENTUM_HUB] NewsEvents error:`, err);
    }

    // ========================================================================
    // SPOKE 4: IndustrialLogistics (SS.00.04)
    // ========================================================================
    try {
      console.log(`[PASS0_MOMENTUM_HUB] Running IndustrialLogistics spoke...`);
      industrialLogistics = await runIndustrialLogistics({
        zip: input.targetZip,
        state: input.targetState,
      });
    } catch (err) {
      this.errors.push(`IndustrialLogistics failed: ${err}`);
      console.error(`[PASS0_MOMENTUM_HUB] IndustrialLogistics error:`, err);
    }

    // ========================================================================
    // SPOKE 5: HousingPipeline (SS.00.05)
    // ========================================================================
    try {
      console.log(`[PASS0_MOMENTUM_HUB] Running HousingPipeline spoke...`);
      housingPipeline = await runHousingPipeline({
        zip: input.targetZip,
        state: input.targetState,
      });
    } catch (err) {
      this.errors.push(`HousingPipeline failed: ${err}`);
      console.error(`[PASS0_MOMENTUM_HUB] HousingPipeline error:`, err);
    }

    // ========================================================================
    // SPOKE 6: MomentumFusion (SS.00.06)
    // ========================================================================
    try {
      console.log(`[PASS0_MOMENTUM_HUB] Running MomentumFusion spoke...`);
      momentumFusion = await runMomentumFusion({
        trendSignal,
        permitActivity,
        newsEvents,
        industrialLogistics,
        housingPipeline,
      });
    } catch (err) {
      this.errors.push(`MomentumFusion failed: ${err}`);
      console.error(`[PASS0_MOMENTUM_HUB] MomentumFusion error:`, err);
    }

    // ========================================================================
    // ASSEMBLE OUTPUT
    // ========================================================================
    const elapsed = Date.now() - startTime;
    console.log(`[PASS0_MOMENTUM_HUB] Run ${this.runId} completed in ${elapsed}ms`);

    const output: Pass0Output = {
      pass: 'PASS0',
      runId: this.runId,
      timestamp: new Date().toISOString(),
      input,
      trendSignal,
      permitActivity,
      newsEvents,
      industrialLogistics,
      housingPipeline,
      momentumFusion,
      aggregatedMomentumScore: momentumFusion?.fusedMomentumScore ?? 0,
      status: this.determineStatus(momentumFusion),
      errors: this.errors,
    };

    return JSON.parse(JSON.stringify(output)); // Ensure JSON-safe
  }

  private determineStatus(momentumFusion: MomentumFusionOutput | null): 'complete' | 'partial' | 'failed' {
    if (this.errors.length === 0 && momentumFusion !== null) {
      return 'complete';
    } else if (this.errors.length > 0 && momentumFusion !== null) {
      return 'partial';
    }
    return 'failed';
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function runPass0(input: Pass0Input): Promise<Pass0Output> {
  const orchestrator = new Pass0Orchestrator();
  return orchestrator.run(input);
}
