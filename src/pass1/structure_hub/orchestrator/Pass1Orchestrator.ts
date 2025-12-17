// Pass1Orchestrator.ts - PASS 1 — STRUCTURE HUB (Constants)
// Doctrine ID: SS.01.00
// Purpose: Market reconnaissance and hotspot identification
// Spokes: ZipHydration, RadiusBuilder, MacroDemand, MacroSupply, CompetitorRegistry, LocalScan, HotspotScoring, ValidationGate

import { runZipHydration } from '../spokes/ZipHydration';
import { runRadiusBuilder } from '../spokes/RadiusBuilder';
import { runMacroDemand } from '../spokes/MacroDemand';
import { runMacroSupply } from '../spokes/MacroSupply';
import { runCompetitorRegistry } from '../spokes/CompetitorRegistry';
import { runLocalScan } from '../spokes/LocalScan';
import { runHotspotScoring } from '../spokes/HotspotScoring';
import { runValidationGate } from '../spokes/ValidationGate';

export interface Pass1Input {
  targetZip: string;
  targetState: string;
  radiusMiles?: number;
  minPopulation?: number;
}

export interface Pass1Output {
  pass: 'PASS1';
  runId: string;
  timestamp: string;
  input: Pass1Input;
  zipHydration: ZipHydrationOutput | null;
  radiusBuilder: RadiusBuilderOutput | null;
  macroDemand: MacroDemandOutput | null;
  macroSupply: MacroSupplyOutput | null;
  competitorRegistry: CompetitorRegistryOutput | null;
  localScan: LocalScanOutput | null;
  hotspotScoring: HotspotScoringOutput | null;
  validationGate: ValidationGateOutput | null;
  hotspotScore: number;
  promotedToPass15: boolean;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

export interface ZipHydrationOutput {
  spokeId: 'SS.01.01';
  zipCode: string;
  city: string;
  county: string;
  state: string;
  population: number | null;
  medianIncome: number | null;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface RadiusBuilderOutput {
  spokeId: 'SS.01.02';
  centerZip: string;
  radiusMiles: number;
  includedZips: string[];
  totalPopulation: number;
  timestamp: string;
}

export interface MacroDemandOutput {
  spokeId: 'SS.01.03';
  populationGrowthRate: number | null;
  employmentGrowthRate: number | null;
  medianHomePrice: number | null;
  rentalVacancyRate: number | null;
  demandScore: number;
  timestamp: string;
}

export interface MacroSupplyOutput {
  spokeId: 'SS.01.04';
  existingStorageFacilities: number;
  totalStorageSqFt: number;
  sqFtPerCapita: number | null;
  supplyScore: number;
  timestamp: string;
}

export interface CompetitorRegistryOutput {
  spokeId: 'SS.01.05';
  competitors: CompetitorRecord[];
  totalCompetitors: number;
  brandBreakdown: Record<string, number>;
  timestamp: string;
}

export interface CompetitorRecord {
  name: string;
  address: string;
  brand: string | null;
  estimatedSqFt: number | null;
  distanceMiles: number;
}

export interface LocalScanOutput {
  spokeId: 'SS.01.06';
  nearbyAmenities: string[];
  trafficScore: number | null;
  visibilityScore: number | null;
  accessScore: number | null;
  timestamp: string;
}

export interface HotspotScoringOutput {
  spokeId: 'SS.01.07';
  hotspotScore: number;
  demandWeight: number;
  supplyWeight: number;
  competitionWeight: number;
  scoreBreakdown: Record<string, number>;
  tier: 'A' | 'B' | 'C' | 'D';
  timestamp: string;
}

export interface ValidationGateOutput {
  spokeId: 'SS.01.08';
  passed: boolean;
  checks: ValidationCheck[];
  promotedToPass15: boolean;
  failureReasons: string[];
  timestamp: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  value: unknown;
  threshold: unknown;
}

export class Pass1Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = 'P1-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  async run(input: Pass1Input): Promise<Pass1Output> {
    console.log('[PASS1_RECON_HUB] Starting run ' + this.runId);
    const startTime = Date.now();

    let zipHydration: ZipHydrationOutput | null = null;
    let radiusBuilder: RadiusBuilderOutput | null = null;
    let macroDemand: MacroDemandOutput | null = null;
    let macroSupply: MacroSupplyOutput | null = null;
    let competitorRegistry: CompetitorRegistryOutput | null = null;
    let localScan: LocalScanOutput | null = null;
    let hotspotScoring: HotspotScoringOutput | null = null;
    let validationGate: ValidationGateOutput | null = null;

    // SPOKE 1: ZipHydration (SS.01.01)
    try {
      console.log('[PASS1_RECON_HUB] Running ZipHydration spoke...');
      zipHydration = await runZipHydration({ zip: input.targetZip, state: input.targetState });
    } catch (err) {
      this.errors.push('ZipHydration failed: ' + err);
    }

    // SPOKE 2: RadiusBuilder (SS.01.02)
    try {
      console.log('[PASS1_RECON_HUB] Running RadiusBuilder spoke...');
      radiusBuilder = await runRadiusBuilder({
        centerZip: input.targetZip,
        radiusMiles: input.radiusMiles ?? 5,
        centerLat: zipHydration?.latitude,
        centerLng: zipHydration?.longitude,
      });
    } catch (err) {
      this.errors.push('RadiusBuilder failed: ' + err);
    }

    // SPOKE 3: MacroDemand (SS.01.03)
    try {
      console.log('[PASS1_RECON_HUB] Running MacroDemand spoke...');
      macroDemand = await runMacroDemand({ zips: radiusBuilder?.includedZips ?? [input.targetZip], state: input.targetState });
    } catch (err) {
      this.errors.push('MacroDemand failed: ' + err);
    }

    // SPOKE 4: MacroSupply (SS.01.04)
    try {
      console.log('[PASS1_RECON_HUB] Running MacroSupply spoke...');
      macroSupply = await runMacroSupply({ zips: radiusBuilder?.includedZips ?? [input.targetZip], state: input.targetState });
    } catch (err) {
      this.errors.push('MacroSupply failed: ' + err);
    }

    // SPOKE 5: CompetitorRegistry (SS.01.05)
    try {
      console.log('[PASS1_RECON_HUB] Running CompetitorRegistry spoke...');
      competitorRegistry = await runCompetitorRegistry({
        centerLat: zipHydration?.latitude,
        centerLng: zipHydration?.longitude,
        radiusMiles: input.radiusMiles ?? 5,
      });
    } catch (err) {
      this.errors.push('CompetitorRegistry failed: ' + err);
    }

    // SPOKE 6: LocalScan (SS.01.06)
    try {
      console.log('[PASS1_RECON_HUB] Running LocalScan spoke...');
      localScan = await runLocalScan({ centerLat: zipHydration?.latitude, centerLng: zipHydration?.longitude, zip: input.targetZip });
    } catch (err) {
      this.errors.push('LocalScan failed: ' + err);
    }

    // SPOKE 7: HotspotScoring (SS.01.07)
    try {
      console.log('[PASS1_RECON_HUB] Running HotspotScoring spoke...');
      hotspotScoring = await runHotspotScoring({ macroDemand, macroSupply, competitorRegistry, localScan });
    } catch (err) {
      this.errors.push('HotspotScoring failed: ' + err);
    }

    // SPOKE 8: ValidationGate (SS.01.08)
    try {
      console.log('[PASS1_RECON_HUB] Running ValidationGate spoke...');
      validationGate = await runValidationGate({
        zipHydration, macroDemand, macroSupply, hotspotScoring,
        minPopulation: input.minPopulation ?? 10000,
      });
    } catch (err) {
      this.errors.push('ValidationGate failed: ' + err);
    }

    const elapsed = Date.now() - startTime;
    console.log('[PASS1_RECON_HUB] Run ' + this.runId + ' completed in ' + elapsed + 'ms');

    const output: Pass1Output = {
      pass: 'PASS1',
      runId: this.runId,
      timestamp: new Date().toISOString(),
      input,
      zipHydration, radiusBuilder, macroDemand, macroSupply,
      competitorRegistry, localScan, hotspotScoring, validationGate,
      hotspotScore: hotspotScoring?.hotspotScore ?? 0,
      promotedToPass15: validationGate?.promotedToPass15 ?? false,
      status: this.determineStatus(validationGate),
      errors: this.errors,
    };

    return JSON.parse(JSON.stringify(output));
  }

  private determineStatus(validationGate: ValidationGateOutput | null): 'complete' | 'partial' | 'failed' {
    if (this.errors.length === 0 && validationGate !== null) return 'complete';
    if (this.errors.length > 0 && validationGate !== null) return 'partial';
    return 'failed';
  }
}

export async function runPass1(input: Pass1Input): Promise<Pass1Output> {
  const orchestrator = new Pass1Orchestrator();
  return orchestrator.run(input);
}
