/**
 * CCA Recon Agent — County Capability Assessment
 * ============================================================================
 *
 * DOCTRINE:
 * "Claude thinks. Neon remembers. Lovable orchestrates."
 *
 * This agent:
 * - Performs CCA reconnaissance
 * - Selects BEST automatable method per pass (API → Scrape → Portal → Manual)
 * - Emits structured JSON only
 * - Has NO persistence authority (Neon handles that)
 *
 * WHAT IT DOES:
 * - Probes official county and state sources
 * - Determines if automation is feasible
 * - Selects best method per pass
 * - Documents WHERE and WHY
 *
 * WHAT IT DOES NOT DO:
 * - Collect real permit, zoning, or inspection data
 * - Merge Pass 0 and Pass 2 logic
 * - Guess or hallucinate capabilities
 * - Write directly to databases
 *
 * ============================================================================
 */

import {
  CcaReconInput,
  CcaReconOutput,
  CcaReconBatchInput,
  CcaReconBatchOutput,
  AutomationMethod,
  CoverageLevel,
  ReconConfidence,
  AUTOMATION_PRIORITY,
  AgentProgress,
  AgentStatus,
} from './types';

import { Pass0DataProbe, Pass0ProbeInput, Pass0ProbeResult } from '../probes/Pass0DataProbe';
import { Pass2DataProbe, Pass2ProbeInput, Pass2ProbeResult } from '../probes/Pass2DataProbe';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 30000;

// =============================================================================
// CCA RECON AGENT
// =============================================================================

export class CcaReconAgent {
  private pass0Probe: Pass0DataProbe;
  private pass2Probe: Pass2DataProbe;
  private progress: AgentProgress;

  constructor() {
    this.pass0Probe = new Pass0DataProbe();
    this.pass2Probe = new Pass2DataProbe();
    this.progress = {
      status: 'idle',
      current_county: null,
      completed: 0,
      total: 0,
      failures: 0,
    };
  }

  // ===========================================================================
  // SINGLE COUNTY RECON
  // ===========================================================================

  /**
   * Perform CCA recon for a single county.
   * Returns structured JSON that Neon will persist.
   */
  async reconCounty(input: CcaReconInput): Promise<CcaReconOutput> {
    const startTime = new Date().toISOString();
    const evidenceLinks: string[] = [];

    // Probe for Pass 0 capabilities (Permits & Inspections)
    const pass0Result = await this.probePass0(input);

    // Probe for Pass 2 capabilities (Jurisdiction / Static Facts)
    const pass2Result = await this.probePass2(input);

    // Collect evidence links
    if (pass0Result.detected_urls.permits_portal) {
      evidenceLinks.push(pass0Result.detected_urls.permits_portal);
    }
    if (pass2Result.detected_urls.planning_department) {
      evidenceLinks.push(pass2Result.detected_urls.planning_department);
    }
    if (pass2Result.detected_urls.zoning_ordinance) {
      evidenceLinks.push(pass2Result.detected_urls.zoning_ordinance);
    }

    // Build output
    const output: CcaReconOutput = {
      county_id: input.county_id,
      state: input.state,
      county_name: input.county_name,

      // Pass 0
      pass0_method: this.selectPass0Method(pass0Result),
      pass0_source_pointer: pass0Result.detected_urls.permits_portal || '',
      pass0_coverage: this.assessPass0Coverage(pass0Result),
      pass0_notes: this.generatePass0Notes(pass0Result),

      // Pass 2
      pass2_method: this.selectPass2Method(pass2Result),
      pass2_source_pointer: pass2Result.detected_urls.planning_department || '',
      pass2_coverage: this.assessPass2Coverage(pass2Result),
      pass2_notes: this.generatePass2Notes(pass2Result),

      // Meta
      confidence: this.calculateOverallConfidence(pass0Result, pass2Result),
      evidence_links: evidenceLinks,
      verified_at: startTime,
    };

    return output;
  }

  // ===========================================================================
  // BATCH RECON
  // ===========================================================================

  /**
   * Perform CCA recon for multiple counties.
   * Respects concurrency limits and timeouts.
   */
  async reconBatch(input: CcaReconBatchInput): Promise<CcaReconBatchOutput> {
    const startTime = Date.now();
    const startIso = new Date().toISOString();
    const concurrency = input.concurrency_limit ?? DEFAULT_CONCURRENCY;
    const timeout = input.timeout_per_county_ms ?? DEFAULT_TIMEOUT_MS;

    this.progress = {
      status: 'probing',
      current_county: null,
      completed: 0,
      total: input.counties.length,
      failures: 0,
    };

    const results: CcaReconOutput[] = [];
    const failures: Array<{
      county_id: number;
      state: string;
      county_name: string;
      error: string;
    }> = [];

    // Process in batches for concurrency control
    for (let i = 0; i < input.counties.length; i += concurrency) {
      const batch = input.counties.slice(i, i + concurrency);

      const batchPromises = batch.map(async (county) => {
        this.progress.current_county = `${county.county_name}, ${county.state}`;

        try {
          const result = await this.withTimeout(
            this.reconCounty(county),
            timeout,
            `Timeout probing ${county.county_name}, ${county.state}`
          );
          results.push(result);
          this.progress.completed++;
        } catch (error) {
          failures.push({
            county_id: county.county_id,
            state: county.state,
            county_name: county.county_name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          this.progress.failures++;
          this.progress.completed++;
        }
      });

      await Promise.all(batchPromises);
    }

    this.progress.status = 'completed';
    this.progress.current_county = null;

    const endTime = Date.now();

    return {
      results,
      failures,
      meta: {
        total_input: input.counties.length,
        total_success: results.length,
        total_failed: failures.length,
        started_at: startIso,
        completed_at: new Date().toISOString(),
        duration_ms: endTime - startTime,
      },
    };
  }

  /**
   * Get current progress for UI updates.
   */
  getProgress(): AgentProgress {
    return { ...this.progress };
  }

  // ===========================================================================
  // PASS 0 PROBING
  // ===========================================================================

  private async probePass0(input: CcaReconInput): Promise<Pass0ProbeResult> {
    const probeInput: Pass0ProbeInput = {
      county_id: input.county_id,
      county_fips: '', // Will be resolved during probe
      county_name: input.county_name,
      state_code: input.state,
    };

    return this.pass0Probe.probe(probeInput);
  }

  /**
   * Select best automation method for Pass 0.
   * MANDATORY: API → Scrape → Portal → Manual
   */
  private selectPass0Method(result: Pass0ProbeResult): AutomationMethod {
    const availability = result.availability;
    const permitMethod = availability.permit_applications.access_method;

    // API is highest priority
    if (permitMethod === 'api') {
      return 'api';
    }

    // Web portal can be scraped
    if (permitMethod === 'web_portal') {
      // Check if it's a known scrapeable vendor
      if (result.detected_vendor) {
        return 'scrape';
      }
      return 'portal';
    }

    // PDF logs require manual processing
    if (permitMethod === 'pdf_download') {
      return 'manual';
    }

    // Default to manual
    return 'manual';
  }

  private assessPass0Coverage(result: Pass0ProbeResult): CoverageLevel {
    const availability = result.availability;

    const hasPermits = availability.permit_applications.availability === 'available';
    const hasInspections = availability.inspection_records.availability === 'available';

    if (hasPermits && hasInspections) {
      return 'full';
    }
    if (hasPermits || hasInspections) {
      return 'partial';
    }
    return 'insufficient';
  }

  private generatePass0Notes(result: Pass0ProbeResult): string {
    const notes: string[] = [];
    const availability = result.availability;

    if (result.detected_vendor) {
      notes.push(`Vendor: ${result.detected_vendor}`);
    }

    if (availability.permit_applications.access_method === 'api') {
      notes.push('API access available');
    }

    if (availability.inspection_records.linked_to_permits) {
      notes.push('Inspections linked to permits');
    }

    if (result.errors.length > 0) {
      notes.push(`Probe warnings: ${result.errors.join(', ')}`);
    }

    if (notes.length === 0) {
      notes.push('No automation signals detected');
    }

    return notes.join('; ');
  }

  // ===========================================================================
  // PASS 2 PROBING
  // ===========================================================================

  private async probePass2(input: CcaReconInput): Promise<Pass2ProbeResult> {
    const probeInput: Pass2ProbeInput = {
      county_id: input.county_id,
      county_fips: '', // Will be resolved during probe
      county_name: input.county_name,
      state_code: input.state,
    };

    return this.pass2Probe.probe(probeInput);
  }

  /**
   * Select best automation method for Pass 2.
   * MANDATORY: API → Scrape → Portal → Manual
   */
  private selectPass2Method(result: Pass2ProbeResult): AutomationMethod {
    const availability = result.availability;
    const recommendation = availability.hydration_recommendation;

    // Firecrawl = scrape
    if (recommendation === 'firecrawl') {
      return 'scrape';
    }

    // Hybrid = portal with some manual
    if (recommendation === 'hybrid') {
      return 'portal';
    }

    // Retell or manual = manual
    if (recommendation === 'retell' || recommendation === 'manual') {
      return 'manual';
    }

    // Check zoning ordinance format
    const ordinanceFormat = availability.zoning_ordinance.format;
    if (ordinanceFormat === 'html') {
      return 'scrape';
    }
    if (ordinanceFormat === 'pdf_searchable') {
      return 'scrape';
    }

    // Default to manual
    return 'manual';
  }

  private assessPass2Coverage(result: Pass2ProbeResult): CoverageLevel {
    const availability = result.availability;
    const viability = availability.overall_viability;

    if (viability === 'high') {
      return 'full';
    }
    if (viability === 'medium') {
      return 'partial';
    }
    return 'insufficient';
  }

  private generatePass2Notes(result: Pass2ProbeResult): string {
    const notes: string[] = [];
    const availability = result.availability;

    // Zoning model
    if (result.zoning_model !== 'unknown') {
      notes.push(`Zoning model: ${result.zoning_model}`);
    }

    // Ordinance format
    const ordinanceFormat = availability.zoning_ordinance.format;
    if (ordinanceFormat !== 'unknown') {
      notes.push(`Ordinance format: ${ordinanceFormat}`);
    }

    // Hydration recommendation
    notes.push(`Recommended: ${availability.hydration_recommendation}`);

    // No zoning counties
    if (result.zoning_model === 'no_zoning') {
      notes.push('County has no zoning ordinance');
    }

    if (result.errors.length > 0) {
      notes.push(`Probe warnings: ${result.errors.join(', ')}`);
    }

    return notes.join('; ');
  }

  // ===========================================================================
  // CONFIDENCE CALCULATION
  // ===========================================================================

  private calculateOverallConfidence(
    pass0Result: Pass0ProbeResult,
    pass2Result: Pass2ProbeResult
  ): ReconConfidence {
    const pass0Confidence = pass0Result.availability.confidence;
    const pass2Confidence = pass2Result.availability.confidence;

    // Both high = high
    if (pass0Confidence === 'high' && pass2Confidence === 'high') {
      return 'high';
    }

    // Both low = low
    if (pass0Confidence === 'low' && pass2Confidence === 'low') {
      return 'low';
    }

    // Mixed = medium
    return 'medium';
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ]);
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let agentInstance: CcaReconAgent | null = null;

/**
 * Get singleton agent instance.
 */
export function getCcaReconAgent(): CcaReconAgent {
  if (!agentInstance) {
    agentInstance = new CcaReconAgent();
  }
  return agentInstance;
}

/**
 * Recon a single county.
 * Returns structured JSON for Neon to persist.
 */
export async function reconCounty(input: CcaReconInput): Promise<CcaReconOutput> {
  const agent = getCcaReconAgent();
  return agent.reconCounty(input);
}

/**
 * Recon multiple counties.
 * Returns batch output with successes and failures.
 */
export async function reconBatch(input: CcaReconBatchInput): Promise<CcaReconBatchOutput> {
  const agent = getCcaReconAgent();
  return agent.reconBatch(input);
}
