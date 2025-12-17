// Pass15Orchestrator.ts - PASS 1.5 — RENT RECON HUB
// Doctrine ID: SS.015.00
// Purpose: Rate evidence collection and verification before underwriting
// Spokes: PublishedRateScraper, AICallWorkOrders, RateEvidenceNormalizer, CoverageConfidence, PromotionGate

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
