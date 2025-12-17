// Pass2Orchestrator.ts - PASS 2 — UNDERWRITING HUB
// Doctrine ID: SS.02.00
// Purpose: Site-specific underwriting and feasibility analysis
// Spokes: Zoning, CivilConstraints, PermitsStatic, PricingVerification, FusionDemand, CompetitivePressure, Feasibility, ReverseFeasibility, MomentumReader, Verdict, VaultMapper

import { runZoning } from '../spokes/Zoning';
import { runCivilConstraints } from '../spokes/CivilConstraints';
import { runPermitsStatic } from '../spokes/PermitsStatic';
import { runPricingVerification } from '../spokes/PricingVerification';
import { runFusionDemand } from '../spokes/FusionDemand';
import { runCompetitivePressure } from '../spokes/CompetitivePressure';
import { runFeasibility } from '../spokes/Feasibility';
import { runReverseFeasibility } from '../spokes/ReverseFeasibility';
import { runMomentumReader } from '../spokes/MomentumReader';
import { runVerdict } from '../spokes/Verdict';
import { runVaultMapper } from '../spokes/VaultMapper';

export interface Pass2Input {
  pass1RunId: string;
  pass15RunId?: string;
  targetZip: string;
  targetState: string;
  parcelId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  acreage?: number;
}

export interface Pass2Output {
  pass: 'PASS2';
  runId: string;
  timestamp: string;
  input: Pass2Input;
  zoning: ZoningOutput | null;
  civilConstraints: CivilConstraintsOutput | null;
  permitsStatic: PermitsStaticOutput | null;
  pricingVerification: PricingVerificationOutput | null;
  fusionDemand: FusionDemandOutput | null;
  competitivePressure: CompetitivePressureOutput | null;
  feasibility: FeasibilityOutput | null;
  reverseFeasibility: ReverseFeasibilityOutput | null;
  momentumReader: MomentumReaderOutput | null;
  verdict: VerdictOutput | null;
  vaultMapper: VaultMapperOutput | null;
  finalVerdict: 'GO' | 'NO_GO' | 'MAYBE';
  verdictScore: number;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

export interface ZoningOutput {
  spokeId: 'SS.02.01';
  zoningCode: string | null;
  zoningDescription: string | null;
  storageAllowed: boolean | null;
  conditionalUse: boolean;
  setbacks: { front: number; side: number; rear: number } | null;
  maxHeight: number | null;
  maxCoverage: number | null;
  timestamp: string;
}

export interface CivilConstraintsOutput {
  spokeId: 'SS.02.02';
  floodZone: string | null;
  wetlands: boolean | null;
  slope: number | null;
  soilType: string | null;
  utilities: { water: boolean; sewer: boolean; electric: boolean; gas: boolean };
  constraints: string[];
  timestamp: string;
}

export interface PermitsStaticOutput {
  spokeId: 'SS.02.03';
  recentPermits: PermitRecord[];
  avgPermitTime: number | null;
  jurisdictionDifficulty: 'easy' | 'moderate' | 'difficult' | null;
  timestamp: string;
}

export interface PermitRecord {
  permitNumber: string;
  type: string;
  status: string;
  issuedDate: string | null;
  value: number | null;
}

export interface PricingVerificationOutput {
  spokeId: 'SS.02.04';
  verifiedRates: VerifiedRate[];
  marketRateAvg: Record<string, number>;
  confidenceLevel: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface VerifiedRate {
  unitSize: string;
  rate: number;
  source: string;
}

export interface FusionDemandOutput {
  spokeId: 'SS.02.05';
  fusedDemandScore: number;
  populationDensity: number | null;
  householdGrowth: number | null;
  incomeLevel: number | null;
  demandDrivers: string[];
  timestamp: string;
}

export interface CompetitivePressureOutput {
  spokeId: 'SS.02.06';
  pressureScore: number;
  nearestCompetitorMiles: number | null;
  competitorsIn3Miles: number;
  competitorsIn5Miles: number;
  marketSaturation: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface FeasibilityOutput {
  spokeId: 'SS.02.07';
  feasible: boolean;
  estimatedUnits: number;
  estimatedSqFt: number;
  estimatedRevenue: number;
  estimatedNOI: number;
  capRate: number;
  dscr: number;
  timestamp: string;
}

export interface ReverseFeasibilityOutput {
  spokeId: 'SS.02.08';
  maxLandPrice: number;
  breakEvenOccupancy: number;
  sensitivityAnalysis: SensitivityResult[];
  timestamp: string;
}

export interface SensitivityResult {
  variable: string;
  baseCase: number;
  pessimistic: number;
  optimistic: number;
}

export interface MomentumReaderOutput {
  spokeId: 'SS.02.09';
  momentumScore: number | null;
  trendDirection: 'up' | 'down' | 'stable' | null;
  pass0RunId: string | null;
  timestamp: string;
}

export interface VerdictOutput {
  spokeId: 'SS.02.10';
  verdict: 'GO' | 'NO_GO' | 'MAYBE';
  score: number;
  weights: Record<string, number>;
  fatalFlaws: string[];
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  timestamp: string;
}

export interface VaultMapperOutput {
  spokeId: 'SS.02.11';
  vaultId: string;
  savedToVault: boolean;
  stampedFields: string[];
  timestamp: string;
}

export class Pass2Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = 'P2-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  async run(input: Pass2Input): Promise<Pass2Output> {
    console.log('[PASS2_UNDERWRITING_HUB] Starting run ' + this.runId);
    const startTime = Date.now();

    let zoning: ZoningOutput | null = null;
    let civilConstraints: CivilConstraintsOutput | null = null;
    let permitsStatic: PermitsStaticOutput | null = null;
    let pricingVerification: PricingVerificationOutput | null = null;
    let fusionDemand: FusionDemandOutput | null = null;
    let competitivePressure: CompetitivePressureOutput | null = null;
    let feasibility: FeasibilityOutput | null = null;
    let reverseFeasibility: ReverseFeasibilityOutput | null = null;
    let momentumReader: MomentumReaderOutput | null = null;
    let verdict: VerdictOutput | null = null;
    let vaultMapper: VaultMapperOutput | null = null;

    // SPOKE 1: Zoning (SS.02.01)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running Zoning spoke...');
      zoning = await runZoning({ parcelId: input.parcelId, address: input.address, state: input.targetState });
    } catch (err) {
      this.errors.push('Zoning failed: ' + err);
    }

    // SPOKE 2: CivilConstraints (SS.02.02)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running CivilConstraints spoke...');
      civilConstraints = await runCivilConstraints({ latitude: input.latitude, longitude: input.longitude, parcelId: input.parcelId });
    } catch (err) {
      this.errors.push('CivilConstraints failed: ' + err);
    }

    // SPOKE 3: PermitsStatic (SS.02.03)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running PermitsStatic spoke...');
      permitsStatic = await runPermitsStatic({ address: input.address, zip: input.targetZip, state: input.targetState });
    } catch (err) {
      this.errors.push('PermitsStatic failed: ' + err);
    }

    // SPOKE 4: PricingVerification (SS.02.04)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running PricingVerification spoke...');
      pricingVerification = await runPricingVerification({ pass15RunId: input.pass15RunId, zip: input.targetZip });
    } catch (err) {
      this.errors.push('PricingVerification failed: ' + err);
    }

    // SPOKE 5: FusionDemand (SS.02.05)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running FusionDemand spoke...');
      fusionDemand = await runFusionDemand({ zip: input.targetZip, state: input.targetState, pass1RunId: input.pass1RunId });
    } catch (err) {
      this.errors.push('FusionDemand failed: ' + err);
    }

    // SPOKE 6: CompetitivePressure (SS.02.06)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running CompetitivePressure spoke...');
      competitivePressure = await runCompetitivePressure({ latitude: input.latitude, longitude: input.longitude, pass1RunId: input.pass1RunId });
    } catch (err) {
      this.errors.push('CompetitivePressure failed: ' + err);
    }

    // SPOKE 7: Feasibility (SS.02.07)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running Feasibility spoke...');
      feasibility = await runFeasibility({
        acreage: input.acreage,
        zoning,
        civilConstraints,
        pricingVerification,
        fusionDemand,
      });
    } catch (err) {
      this.errors.push('Feasibility failed: ' + err);
    }

    // SPOKE 8: ReverseFeasibility (SS.02.08)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running ReverseFeasibility spoke...');
      reverseFeasibility = await runReverseFeasibility({ feasibility, competitivePressure });
    } catch (err) {
      this.errors.push('ReverseFeasibility failed: ' + err);
    }

    // SPOKE 9: MomentumReader (SS.02.09)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running MomentumReader spoke...');
      momentumReader = await runMomentumReader({ zip: input.targetZip, state: input.targetState });
    } catch (err) {
      this.errors.push('MomentumReader failed: ' + err);
    }

    // SPOKE 10: Verdict (SS.02.10)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running Verdict spoke...');
      verdict = await runVerdict({
        zoning, civilConstraints, permitsStatic, pricingVerification,
        fusionDemand, competitivePressure, feasibility, reverseFeasibility, momentumReader,
      });
    } catch (err) {
      this.errors.push('Verdict failed: ' + err);
    }

    // SPOKE 11: VaultMapper (SS.02.11)
    try {
      console.log('[PASS2_UNDERWRITING_HUB] Running VaultMapper spoke...');
      vaultMapper = await runVaultMapper({
        runId: this.runId,
        input,
        verdict,
        allSpokeOutputs: {
          zoning, civilConstraints, permitsStatic, pricingVerification,
          fusionDemand, competitivePressure, feasibility, reverseFeasibility, momentumReader,
        },
      });
    } catch (err) {
      this.errors.push('VaultMapper failed: ' + err);
    }

    const elapsed = Date.now() - startTime;
    console.log('[PASS2_UNDERWRITING_HUB] Run ' + this.runId + ' completed in ' + elapsed + 'ms');

    const output: Pass2Output = {
      pass: 'PASS2',
      runId: this.runId,
      timestamp: new Date().toISOString(),
      input,
      zoning, civilConstraints, permitsStatic, pricingVerification,
      fusionDemand, competitivePressure, feasibility, reverseFeasibility,
      momentumReader, verdict, vaultMapper,
      finalVerdict: verdict?.verdict ?? 'NO_GO',
      verdictScore: verdict?.score ?? 0,
      status: this.determineStatus(verdict),
      errors: this.errors,
    };

    return JSON.parse(JSON.stringify(output));
  }

  private determineStatus(verdict: VerdictOutput | null): 'complete' | 'partial' | 'failed' {
    if (this.errors.length === 0 && verdict !== null) return 'complete';
    if (this.errors.length > 0 && verdict !== null) return 'partial';
    return 'failed';
  }
}

export async function runPass2(input: Pass2Input): Promise<Pass2Output> {
  const orchestrator = new Pass2Orchestrator();
  return orchestrator.run(input);
}
