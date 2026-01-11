/**
 * Pass4Orchestrator.ts - SubHub4_ParcelDiscovery
 *
 * Doctrine ID: SS.04.00
 * Purpose: Parcel scanning within ZIP boundaries and promotion gating
 * Anchor: ZIP (search) -> Parcel ID (promotion)
 * Constraint: ZIP_BOUNDED_SEARCH
 *
 * Spokes: ParcelScanner, ParcelFilter, SiteScorer, PromotionGate
 */

import { runParcelScanner, ParcelScannerInput } from '../spokes/ParcelScanner';
import { runParcelFilter, ParcelFilterInput } from '../spokes/ParcelFilter';
import { runSiteScorer, SiteScorerInput } from '../spokes/SiteScorer';
import { runPromotionGate, PromotionGateInput } from '../spokes/PromotionGate';
import {
  Pass4Input,
  Pass4Output,
  ParcelScannerResult,
  ParcelFilterResult,
  SiteScorerResult,
  PromotionGateBatchResult,
  createStubParcelScanner,
  createStubParcelFilter,
  createStubSiteScorer,
  createStubPromotionGate,
} from '../types/pass4_types';

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class Pass4Orchestrator {
  private runId: string;
  private errors: string[] = [];

  constructor() {
    this.runId = `P4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute SubHub4_ParcelDiscovery
   *
   * Order: ParcelScanner → ParcelFilter → SiteScorer → PromotionGate
   *
   * CONSTRAINT: ZIP_BOUNDED_SEARCH - All operations bounded by input ZIP
   */
  async run(input: Pass4Input): Promise<Pass4Output> {
    console.log(`[SUBHUB4_PARCEL_DISCOVERY] Starting run ${this.runId}`);
    console.log(`[SUBHUB4_PARCEL_DISCOVERY] ZIP Anchor: ${input.zipCode}`);
    const startTime = Date.now();

    let parcelScanner: ParcelScannerResult = createStubParcelScanner();
    let parcelFilter: ParcelFilterResult = createStubParcelFilter();
    let siteScorer: SiteScorerResult = createStubSiteScorer();
    let promotionGate: PromotionGateBatchResult = createStubPromotionGate();

    // ========================================================================
    // SPOKE 1: ParcelScanner (SS.04.01)
    // ========================================================================
    try {
      console.log(`[SUBHUB4_PARCEL_DISCOVERY] Running ParcelScanner spoke...`);

      const scannerInput: ParcelScannerInput = {
        zipCode: input.zipCode,
        state: input.state,
        maxResults: input.maxResults ?? 100,
      };

      parcelScanner = await runParcelScanner(scannerInput);

      if (parcelScanner.status === 'error') {
        this.errors.push(`ParcelScanner: ${parcelScanner.notes}`);
      }
    } catch (err) {
      this.errors.push(`ParcelScanner failed: ${err}`);
      console.error(`[SUBHUB4_PARCEL_DISCOVERY] ParcelScanner error:`, err);
    }

    // ========================================================================
    // SPOKE 2: ParcelFilter (SS.04.02)
    // ========================================================================
    try {
      console.log(`[SUBHUB4_PARCEL_DISCOVERY] Running ParcelFilter spoke...`);

      if (parcelScanner.parcels && parcelScanner.parcels.length > 0) {
        const filterInput: ParcelFilterInput = {
          parcels: parcelScanner.parcels,
          criteria: input.filterCriteria ?? {},
          zipCode: input.zipCode,
        };

        parcelFilter = await runParcelFilter(filterInput);

        if (parcelFilter.status === 'error') {
          this.errors.push(`ParcelFilter: ${parcelFilter.notes}`);
        }
      } else {
        parcelFilter = {
          status: 'ok',
          totalEvaluated: 0,
          passedCount: 0,
          failedCount: 0,
          reviewCount: 0,
          filteredParcels: [],
          notes: 'No parcels to filter.',
        };
      }
    } catch (err) {
      this.errors.push(`ParcelFilter failed: ${err}`);
      console.error(`[SUBHUB4_PARCEL_DISCOVERY] ParcelFilter error:`, err);
    }

    // ========================================================================
    // SPOKE 3: SiteScorer (SS.04.03)
    // ========================================================================
    try {
      console.log(`[SUBHUB4_PARCEL_DISCOVERY] Running SiteScorer spoke...`);

      if (parcelFilter.filteredParcels && parcelFilter.filteredParcels.length > 0) {
        const scorerInput: SiteScorerInput = {
          parcels: parcelFilter.filteredParcels,
          targetAcreage: input.filterCriteria?.minAcreage ?? 2.0,
        };

        siteScorer = await runSiteScorer(scorerInput);

        if (siteScorer.status === 'error') {
          this.errors.push(`SiteScorer: ${siteScorer.notes}`);
        }
      } else {
        siteScorer = {
          status: 'ok',
          totalScored: 0,
          scores: [],
          topParcels: [],
          notes: 'No parcels to score.',
        };
      }
    } catch (err) {
      this.errors.push(`SiteScorer failed: ${err}`);
      console.error(`[SUBHUB4_PARCEL_DISCOVERY] SiteScorer error:`, err);
    }

    // ========================================================================
    // SPOKE 4: PromotionGate (SS.04.04)
    // ========================================================================
    try {
      console.log(`[SUBHUB4_PARCEL_DISCOVERY] Running PromotionGate spoke...`);

      if (parcelFilter.filteredParcels && parcelFilter.filteredParcels.length > 0) {
        const promotionInput: PromotionGateInput = {
          parcels: parcelFilter.filteredParcels,
          scores: siteScorer,
          svaId: input.svaId,
          minScore: 50,
          maxPromotions: 20,
        };

        promotionGate = await runPromotionGate(promotionInput);

        if (promotionGate.status === 'error') {
          this.errors.push(`PromotionGate: ${promotionGate.notes}`);
        }
      } else {
        promotionGate = {
          status: 'ok',
          totalEvaluated: 0,
          promotedCount: 0,
          rejectedCount: 0,
          promotedParcels: [],
          rejectionSummary: {},
          notes: 'No parcels to promote.',
        };
      }
    } catch (err) {
      this.errors.push(`PromotionGate failed: ${err}`);
      console.error(`[SUBHUB4_PARCEL_DISCOVERY] PromotionGate error:`, err);
    }

    // ========================================================================
    // ASSEMBLE OUTPUT
    // ========================================================================
    const elapsed = Date.now() - startTime;
    console.log(`[SUBHUB4_PARCEL_DISCOVERY] Run ${this.runId} completed in ${elapsed}ms`);

    const output: Pass4Output = {
      success: this.errors.length === 0,
      runId: this.runId,
      timestamp: Date.now(),
      zipCode: input.zipCode,
      state: input.state,
      svaId: input.svaId,
      parcelScanner,
      parcelFilter,
      siteScorer,
      promotionGate,
      summary: {
        totalScanned: parcelScanner.totalFound ?? 0,
        totalFiltered: parcelFilter.passedCount ?? 0,
        totalPromoted: promotionGate.promotedCount ?? 0,
        promotionRate:
          parcelScanner.totalFound && parcelScanner.totalFound > 0
            ? (promotionGate.promotedCount ?? 0) / parcelScanner.totalFound
            : 0,
      },
      error: this.errors.length > 0 ? this.errors.join('; ') : undefined,
    };

    return JSON.parse(JSON.stringify(output));
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function runPass4(input: Pass4Input): Promise<Pass4Output> {
  const orchestrator = new Pass4Orchestrator();
  return orchestrator.run(input);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Pass4Orchestrator;
