// Pass3Orchestrator.ts - PASS 3 — DESIGN/CALCULATOR HUB
// Doctrine ID: SS.03.00
// Purpose: Detailed pro forma modeling and financial analysis
// Spokes: SetbackEngine, CoverageEngine, UnitMixOptimizer, PhasePlanner, BuildCostModel, NOIEngine, DebtModel, MaxLandPrice, IRRModel

import { runSetbackEngine } from '../spokes/SetbackEngine';
import { runCoverageEngine } from '../spokes/CoverageEngine';
import { runUnitMixOptimizer } from '../spokes/UnitMixOptimizer';
import { runPhasePlanner } from '../spokes/PhasePlanner';
import { runBuildCostModel } from '../spokes/BuildCostModel';
import { runNOIEngine } from '../spokes/NOIEngine';
import { runDebtModel } from '../spokes/DebtModel';
import { runMaxLandPrice } from '../spokes/MaxLandPrice';
import { runIRRModel } from '../spokes/IRRModel';

export interface Pass3Input {
  pass2RunId: string;
  parcelId: string;
  acreage: number;
  zoning: ZoningConstraints;
  targetIRR?: number;
  targetDSCR?: number;
  holdPeriodYears?: number;
}

export interface ZoningConstraints {
  maxCoverage: number;
  maxHeight: number;
  setbacks: { front: number; side: number; rear: number };
  maxStories: number;
}

export interface Pass3Output {
  pass: 'PASS3';
  runId: string;
  timestamp: string;
  input: Pass3Input;
  setbackEngine: SetbackEngineOutput | null;
  coverageEngine: CoverageEngineOutput | null;
  unitMixOptimizer: UnitMixOptimizerOutput | null;
  phasePlanner: PhasePlannerOutput | null;
  buildCostModel: BuildCostModelOutput | null;
  noiEngine: NOIEngineOutput | null;
  debtModel: DebtModelOutput | null;
  maxLandPrice: MaxLandPriceOutput | null;
  irrModel: IRRModelOutput | null;
  proFormaComplete: boolean;
  projectedIRR: number;
  projectedNOI: number;
  maxLandValue: number;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

export interface SetbackEngineOutput {
  spokeId: 'SS.03.01';
  buildableArea: number;
  setbackPolygon: Coordinate[];
  constrainedBy: string[];
  timestamp: string;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface CoverageEngineOutput {
  spokeId: 'SS.03.02';
  maxBuildableSqFt: number;
  coveragePercent: number;
  stories: number;
  footprintSqFt: number;
  timestamp: string;
}

export interface UnitMixOptimizerOutput {
  spokeId: 'SS.03.03';
  unitMix: UnitMix[];
  totalUnits: number;
  totalSqFt: number;
  avgRentPerSqFt: number;
  timestamp: string;
}

export interface UnitMix {
  size: string;
  count: number;
  sqFtEach: number;
  monthlyRent: number;
}

export interface PhasePlannerOutput {
  spokeId: 'SS.03.04';
  phases: Phase[];
  totalPhases: number;
  constructionMonths: number;
  leaseUpMonths: number;
  timestamp: string;
}

export interface Phase {
  phaseNumber: number;
  units: number;
  sqFt: number;
  startMonth: number;
  completionMonth: number;
}

export interface BuildCostModelOutput {
  spokeId: 'SS.03.05';
  hardCosts: number;
  softCosts: number;
  contingency: number;
  totalDevelopmentCost: number;
  costPerSqFt: number;
  timestamp: string;
}

export interface NOIEngineOutput {
  spokeId: 'SS.03.06';
  grossPotentialRent: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  expenseRatio: number;
  timestamp: string;
}

export interface DebtModelOutput {
  spokeId: 'SS.03.07';
  loanAmount: number;
  interestRate: number;
  termYears: number;
  annualDebtService: number;
  dscr: number;
  ltv: number;
  timestamp: string;
}

export interface MaxLandPriceOutput {
  spokeId: 'SS.03.08';
  maxLandPrice: number;
  pricePerAcre: number;
  residualAnalysis: ResidualAnalysis;
  timestamp: string;
}

export interface ResidualAnalysis {
  stabilizedValue: number;
  totalCosts: number;
  developerProfit: number;
  residualLandValue: number;
}

export interface IRRModelOutput {
  spokeId: 'SS.03.09';
  projectIRR: number;
  equityMultiple: number;
  cashOnCash: number[];
  npv: number;
  paybackPeriod: number;
  exitCapRate: number;
  exitValue: number;
  timestamp: string;
}

export class Pass3Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = 'P3-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  async run(input: Pass3Input): Promise<Pass3Output> {
    console.log('[PASS3_PROFORMA_HUB] Starting run ' + this.runId);
    const startTime = Date.now();

    let setbackEngine: SetbackEngineOutput | null = null;
    let coverageEngine: CoverageEngineOutput | null = null;
    let unitMixOptimizer: UnitMixOptimizerOutput | null = null;
    let phasePlanner: PhasePlannerOutput | null = null;
    let buildCostModel: BuildCostModelOutput | null = null;
    let noiEngine: NOIEngineOutput | null = null;
    let debtModel: DebtModelOutput | null = null;
    let maxLandPrice: MaxLandPriceOutput | null = null;
    let irrModel: IRRModelOutput | null = null;

    // SPOKE 1: SetbackEngine (SS.03.01)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running SetbackEngine spoke...');
      setbackEngine = await runSetbackEngine({ acreage: input.acreage, setbacks: input.zoning.setbacks });
    } catch (err) {
      this.errors.push('SetbackEngine failed: ' + err);
    }

    // SPOKE 2: CoverageEngine (SS.03.02)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running CoverageEngine spoke...');
      coverageEngine = await runCoverageEngine({
        buildableArea: setbackEngine?.buildableArea ?? 0,
        maxCoverage: input.zoning.maxCoverage,
        maxHeight: input.zoning.maxHeight,
        maxStories: input.zoning.maxStories,
      });
    } catch (err) {
      this.errors.push('CoverageEngine failed: ' + err);
    }

    // SPOKE 3: UnitMixOptimizer (SS.03.03)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running UnitMixOptimizer spoke...');
      unitMixOptimizer = await runUnitMixOptimizer({
        totalSqFt: coverageEngine?.maxBuildableSqFt ?? 0,
        pass2RunId: input.pass2RunId,
      });
    } catch (err) {
      this.errors.push('UnitMixOptimizer failed: ' + err);
    }

    // SPOKE 4: PhasePlanner (SS.03.04)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running PhasePlanner spoke...');
      phasePlanner = await runPhasePlanner({
        totalUnits: unitMixOptimizer?.totalUnits ?? 0,
        totalSqFt: unitMixOptimizer?.totalSqFt ?? 0,
      });
    } catch (err) {
      this.errors.push('PhasePlanner failed: ' + err);
    }

    // SPOKE 5: BuildCostModel (SS.03.05)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running BuildCostModel spoke...');
      buildCostModel = await runBuildCostModel({
        totalSqFt: unitMixOptimizer?.totalSqFt ?? 0,
        stories: coverageEngine?.stories ?? 1,
        phases: phasePlanner?.phases ?? [],
      });
    } catch (err) {
      this.errors.push('BuildCostModel failed: ' + err);
    }

    // SPOKE 6: NOIEngine (SS.03.06)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running NOIEngine spoke...');
      noiEngine = await runNOIEngine({
        unitMix: unitMixOptimizer?.unitMix ?? [],
        totalUnits: unitMixOptimizer?.totalUnits ?? 0,
      });
    } catch (err) {
      this.errors.push('NOIEngine failed: ' + err);
    }

    // SPOKE 7: DebtModel (SS.03.07)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running DebtModel spoke...');
      debtModel = await runDebtModel({
        totalDevelopmentCost: buildCostModel?.totalDevelopmentCost ?? 0,
        noi: noiEngine?.netOperatingIncome ?? 0,
        targetDSCR: input.targetDSCR ?? 1.25,
      });
    } catch (err) {
      this.errors.push('DebtModel failed: ' + err);
    }

    // SPOKE 8: MaxLandPrice (SS.03.08)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running MaxLandPrice spoke...');
      maxLandPrice = await runMaxLandPrice({
        noi: noiEngine?.netOperatingIncome ?? 0,
        buildCosts: buildCostModel?.totalDevelopmentCost ?? 0,
        targetIRR: input.targetIRR ?? 0.15,
        acreage: input.acreage,
      });
    } catch (err) {
      this.errors.push('MaxLandPrice failed: ' + err);
    }

    // SPOKE 9: IRRModel (SS.03.09)
    try {
      console.log('[PASS3_PROFORMA_HUB] Running IRRModel spoke...');
      irrModel = await runIRRModel({
        buildCosts: buildCostModel?.totalDevelopmentCost ?? 0,
        noi: noiEngine?.netOperatingIncome ?? 0,
        debtService: debtModel?.annualDebtService ?? 0,
        holdPeriodYears: input.holdPeriodYears ?? 5,
        loanAmount: debtModel?.loanAmount ?? 0,
      });
    } catch (err) {
      this.errors.push('IRRModel failed: ' + err);
    }

    const elapsed = Date.now() - startTime;
    console.log('[PASS3_PROFORMA_HUB] Run ' + this.runId + ' completed in ' + elapsed + 'ms');

    const output: Pass3Output = {
      pass: 'PASS3',
      runId: this.runId,
      timestamp: new Date().toISOString(),
      input,
      setbackEngine, coverageEngine, unitMixOptimizer, phasePlanner,
      buildCostModel, noiEngine, debtModel, maxLandPrice, irrModel,
      proFormaComplete: irrModel !== null,
      projectedIRR: irrModel?.projectIRR ?? 0,
      projectedNOI: noiEngine?.netOperatingIncome ?? 0,
      maxLandValue: maxLandPrice?.maxLandPrice ?? 0,
      status: this.determineStatus(irrModel),
      errors: this.errors,
    };

    return JSON.parse(JSON.stringify(output));
  }

  private determineStatus(irrModel: IRRModelOutput | null): 'complete' | 'partial' | 'failed' {
    if (this.errors.length === 0 && irrModel !== null) return 'complete';
    if (this.errors.length > 0 && irrModel !== null) return 'partial';
    return 'failed';
  }
}

export async function runPass3(input: Pass3Input): Promise<Pass3Output> {
  const orchestrator = new Pass3Orchestrator();
  return orchestrator.run(input);
}
