const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/CUSTOM PC/Desktop/Cursor Builds/storage container go-nogo/src';

// Pass1 Orchestrator
const pass1Content = `// Pass1Orchestrator.ts - Pass-1 Recon Hub Orchestrator
// Doctrine ID: SS.01.00
// Purpose: Market reconnaissance and hotspot identification

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
`;

// Pass15 Orchestrator
const pass15Content = `// Pass15Orchestrator.ts - Pass-1.5 Rate Verification Hub Orchestrator
// Doctrine ID: SS.015.00
// Purpose: Rate evidence collection and verification before underwriting

import { runPublishedRateScraper } from '../spokes/PublishedRateScraper';
import { runAICallWorkOrders } from '../spokes/AICallWorkOrders';
import { runRateEvidenceNormalizer } from '../spokes/RateEvidenceNormalizer';
import { runCoverageConfidence } from '../spokes/CoverageConfidence';
import { runPromotionGate } from '../spokes/PromotionGate';

export interface Pass15Input {
  pass1RunId: string;
  targetZip: string;
  competitors: CompetitorForRates[];
  minCoverageThreshold?: number;
}

export interface CompetitorForRates {
  name: string;
  address: string;
  phone?: string;
  website?: string;
}

export interface Pass15Output {
  pass: 'PASS15';
  runId: string;
  timestamp: string;
  input: Pass15Input;
  publishedRateScraper: PublishedRateScraperOutput | null;
  aiCallWorkOrders: AICallWorkOrdersOutput | null;
  rateEvidenceNormalizer: RateEvidenceNormalizerOutput | null;
  coverageConfidence: CoverageConfidenceOutput | null;
  promotionGate: PromotionGateOutput | null;
  coverageScore: number;
  promotedToPass2: boolean;
  status: 'complete' | 'partial' | 'failed';
  errors: string[];
}

export interface PublishedRateScraperOutput {
  spokeId: 'SS.015.01';
  scrapedRates: ScrapedRate[];
  successCount: number;
  failureCount: number;
  timestamp: string;
}

export interface ScrapedRate {
  competitorName: string;
  unitSize: string;
  monthlyRate: number | null;
  source: 'website' | 'aggregator';
  confidence: number;
}

export interface AICallWorkOrdersOutput {
  spokeId: 'SS.015.02';
  workOrders: CallWorkOrder[];
  totalCalls: number;
  completedCalls: number;
  timestamp: string;
}

export interface CallWorkOrder {
  competitorName: string;
  phone: string;
  status: 'pending' | 'completed' | 'failed' | 'no_answer';
  ratesCollected: CollectedRate[];
}

export interface CollectedRate {
  unitSize: string;
  monthlyRate: number;
  moveInSpecial?: string;
}

export interface RateEvidenceNormalizerOutput {
  spokeId: 'SS.015.03';
  normalizedRates: NormalizedRate[];
  averageBySize: Record<string, number>;
  medianBySize: Record<string, number>;
  timestamp: string;
}

export interface NormalizedRate {
  competitorName: string;
  unitSize: string;
  normalizedRate: number;
  source: 'scraped' | 'call' | 'blended';
  confidence: number;
}

export interface CoverageConfidenceOutput {
  spokeId: 'SS.015.04';
  overallCoverage: number;
  coverageBySize: Record<string, number>;
  competitorsCovered: number;
  competitorsTotal: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface PromotionGateOutput {
  spokeId: 'SS.015.05';
  passed: boolean;
  coverageScore: number;
  threshold: number;
  promotedToPass2: boolean;
  failureReasons: string[];
  timestamp: string;
}

export class Pass15Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = 'P15-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  async run(input: Pass15Input): Promise<Pass15Output> {
    console.log('[PASS15_RATE_HUB] Starting run ' + this.runId);
    const startTime = Date.now();

    let publishedRateScraper: PublishedRateScraperOutput | null = null;
    let aiCallWorkOrders: AICallWorkOrdersOutput | null = null;
    let rateEvidenceNormalizer: RateEvidenceNormalizerOutput | null = null;
    let coverageConfidence: CoverageConfidenceOutput | null = null;
    let promotionGate: PromotionGateOutput | null = null;

    // SPOKE 1: PublishedRateScraper (SS.015.01)
    try {
      console.log('[PASS15_RATE_HUB] Running PublishedRateScraper spoke...');
      publishedRateScraper = await runPublishedRateScraper({ competitors: input.competitors });
    } catch (err) {
      this.errors.push('PublishedRateScraper failed: ' + err);
    }

    // SPOKE 2: AICallWorkOrders (SS.015.02)
    try {
      console.log('[PASS15_RATE_HUB] Running AICallWorkOrders spoke...');
      aiCallWorkOrders = await runAICallWorkOrders({
        competitors: input.competitors,
        scrapedRates: publishedRateScraper?.scrapedRates ?? [],
      });
    } catch (err) {
      this.errors.push('AICallWorkOrders failed: ' + err);
    }

    // SPOKE 3: RateEvidenceNormalizer (SS.015.03)
    try {
      console.log('[PASS15_RATE_HUB] Running RateEvidenceNormalizer spoke...');
      rateEvidenceNormalizer = await runRateEvidenceNormalizer({
        scrapedRates: publishedRateScraper?.scrapedRates ?? [],
        callRates: aiCallWorkOrders?.workOrders ?? [],
      });
    } catch (err) {
      this.errors.push('RateEvidenceNormalizer failed: ' + err);
    }

    // SPOKE 4: CoverageConfidence (SS.015.04)
    try {
      console.log('[PASS15_RATE_HUB] Running CoverageConfidence spoke...');
      coverageConfidence = await runCoverageConfidence({
        normalizedRates: rateEvidenceNormalizer?.normalizedRates ?? [],
        totalCompetitors: input.competitors.length,
      });
    } catch (err) {
      this.errors.push('CoverageConfidence failed: ' + err);
    }

    // SPOKE 5: PromotionGate (SS.015.05)
    try {
      console.log('[PASS15_RATE_HUB] Running PromotionGate spoke...');
      promotionGate = await runPromotionGate({
        coverageConfidence,
        minCoverageThreshold: input.minCoverageThreshold ?? 0.6,
      });
    } catch (err) {
      this.errors.push('PromotionGate failed: ' + err);
    }

    const elapsed = Date.now() - startTime;
    console.log('[PASS15_RATE_HUB] Run ' + this.runId + ' completed in ' + elapsed + 'ms');

    const output: Pass15Output = {
      pass: 'PASS15',
      runId: this.runId,
      timestamp: new Date().toISOString(),
      input,
      publishedRateScraper,
      aiCallWorkOrders,
      rateEvidenceNormalizer,
      coverageConfidence,
      promotionGate,
      coverageScore: coverageConfidence?.overallCoverage ?? 0,
      promotedToPass2: promotionGate?.promotedToPass2 ?? false,
      status: this.determineStatus(promotionGate),
      errors: this.errors,
    };

    return JSON.parse(JSON.stringify(output));
  }

  private determineStatus(promotionGate: PromotionGateOutput | null): 'complete' | 'partial' | 'failed' {
    if (this.errors.length === 0 && promotionGate !== null) return 'complete';
    if (this.errors.length > 0 && promotionGate !== null) return 'partial';
    return 'failed';
  }
}

export async function runPass15(input: Pass15Input): Promise<Pass15Output> {
  const orchestrator = new Pass15Orchestrator();
  return orchestrator.run(input);
}
`;

// Pass2 Orchestrator
const pass2Content = `// Pass2Orchestrator.ts - Pass-2 Underwriting Hub Orchestrator
// Doctrine ID: SS.02.00
// Purpose: Site-specific underwriting and feasibility analysis

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
`;

// Pass3 Orchestrator
const pass3Content = `// Pass3Orchestrator.ts - Pass-3 Pro Forma Hub Orchestrator
// Doctrine ID: SS.03.00
// Purpose: Detailed pro forma modeling and financial analysis

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
`;

// Write all files
fs.writeFileSync(path.join(baseDir, 'pass1_hub/orchestrator/Pass1Orchestrator.ts'), pass1Content);
console.log('Written: Pass1Orchestrator.ts');

fs.writeFileSync(path.join(baseDir, 'pass15_hub/orchestrator/Pass15Orchestrator.ts'), pass15Content);
console.log('Written: Pass15Orchestrator.ts');

fs.writeFileSync(path.join(baseDir, 'pass2_hub/orchestrator/Pass2Orchestrator.ts'), pass2Content);
console.log('Written: Pass2Orchestrator.ts');

fs.writeFileSync(path.join(baseDir, 'pass3_hub/orchestrator/Pass3Orchestrator.ts'), pass3Content);
console.log('Written: Pass3Orchestrator.ts');

console.log('All orchestrators written successfully!');
