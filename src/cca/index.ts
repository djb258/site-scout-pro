/**
 * CCA (County Capability Asset) — Standalone Service
 * ============================================================================
 *
 * DOCTRINE:
 * "Claude thinks. Neon remembers. Lovable orchestrates."
 *
 * CCA is a STANDALONE service that runs UPFRONT before any pass.
 * It answers: HOW do we collect information from this county?
 *             WHAT information is available to collect?
 *
 * CCA must be collected BEFORE:
 *   - Pass 0 can gather permits/inspections
 *   - Pass 2 can hydrate jurisdiction cards
 *
 * CCA does NOT answer WHAT the jurisdiction rules are.
 * That is Pass 2's job.
 *
 * SEPARATION:
 *   CCA (ref schema)  = HOW to collect data
 *   Pass 2 (pass2 schema) = WHAT the jurisdiction facts are
 *   Pass 3 = Consumes Pass 2 blindly, NEVER references CCA
 *
 * FLOW:
 *   Lovable → County Resolver → Dedupe (Neon) → CCA Recon Agent
 *         → Neon (persist) → Lovable (dispatch workers)
 *
 * ============================================================================
 */

// =============================================================================
// TYPES
// =============================================================================

export {
  // Core types
  AutomationClass,
  ZoningModelType,
  PermitSystemType,
  DocumentQuality,
  ConfidenceCeiling,
  CountyCapabilityProfile,
  CcaProbeInput,
  CcaProbeResult,
  CcaServiceStatus,
  CcaPass0Contract,
  CcaPass2Contract,
  ProbeReason,
  CCA_TTL_MONTHS,
  CCA_MAX_RETRIES,
  KNOWN_VENDORS,
  KnownVendor,
} from './types/cca_types';

export {
  // Data availability types
  DataAvailability,
  DataAccessMethod,
  Pass0DataAvailability,
  Pass2DataAvailability,
  CcaDataAvailability,
  createEmptyPass0Availability,
  createEmptyPass2Availability,
} from './types/cca_data_availability';

// =============================================================================
// SERVICE
// =============================================================================

export {
  CcaService,
  getCcaService,
  hasCountyCoverage,
  ensureCcaExists,
} from './service/CcaService';

// =============================================================================
// PROBES
// =============================================================================

export {
  Pass0DataProbe,
  Pass0ProbeInput,
  Pass0ProbeResult,
  probePass0Data,
} from './probes/Pass0DataProbe';

export {
  Pass2DataProbe,
  Pass2ProbeInput,
  Pass2ProbeResult,
  probePass2Data,
} from './probes/Pass2DataProbe';

// =============================================================================
// CONSUMERS (Read-Only APIs for Passes)
// =============================================================================

export {
  Pass0CcaConsumer,
  Pass0CcaResult,
  Pass0Recommendation,
  getPass0Consumer,
  canPass0Automate,
  getPass0Ceiling,
} from './consumers/Pass0Consumer';

export {
  Pass2CcaConsumer,
  Pass2CcaResult,
  Pass2Recommendation,
  HydrationRoute,
  HydrationRouteResult,
  getPass2Consumer,
  getHydrationRoute,
  isNoZoning,
  getPass2Ceiling,
} from './consumers/Pass2Consumer';

// =============================================================================
// RECON AGENT
// =============================================================================

export {
  // Types
  AutomationMethod,
  CoverageLevel,
  ReconConfidence,
  CcaReconInput,
  CcaReconOutput,
  CcaReconBatchInput,
  CcaReconBatchOutput,
  AgentStatus,
  AgentProgress,
  AUTOMATION_PRIORITY,
  // Agent
  CcaReconAgent,
  getCcaReconAgent,
  reconCounty,
  reconBatch,
} from './agent';

// =============================================================================
// QUICK REFERENCE
// =============================================================================

/**
 * CCA USAGE GUIDE:
 *
 * 1. PROBE A COUNTY (collect CCA data):
 *    ```
 *    import { getCcaService } from '@/cca';
 *
 *    const service = getCcaService();
 *    const result = await service.probeCounty({
 *      county_id: 123,
 *      county_fips: '48201',
 *      county_name: 'Harris',
 *      state_code: 'TX',
 *    });
 *    ```
 *
 * 2. PASS 0 CONSUMPTION (how to collect permits):
 *    ```
 *    import { getPass0Consumer } from '@/cca';
 *
 *    const consumer = getPass0Consumer();
 *    const result = await consumer.getForCounty(123);
 *
 *    if (result.recommendation.can_automate) {
 *      // Use result.contract.permits_url
 *    }
 *    ```
 *
 * 3. PASS 2 CONSUMPTION (how to hydrate jurisdiction card):
 *    ```
 *    import { getPass2Consumer, getHydrationRoute } from '@/cca';
 *
 *    const route = await getHydrationRoute(123);
 *
 *    switch (route.route) {
 *      case 'firecrawl':
 *        // Scrape route.firecrawl_urls
 *        break;
 *      case 'retell':
 *        // Make phone calls
 *        break;
 *      case 'manual_queue':
 *        // Queue for manual research
 *        break;
 *    }
 *    ```
 *
 * 4. CHECK COVERAGE:
 *    ```
 *    import { hasCountyCoverage } from '@/cca';
 *
 *    const hasCca = await hasCountyCoverage(123);
 *    if (!hasCca) {
 *      // Need to probe first
 *    }
 *    ```
 *
 * 5. CCA RECON AGENT (Lovable → Claude → Neon flow):
 *    ```
 *    import { reconCounty, reconBatch } from '@/cca';
 *
 *    // Single county recon
 *    const result = await reconCounty({
 *      county_id: 123,
 *      state: 'TX',
 *      county_name: 'Harris',
 *    });
 *
 *    // result.pass0_method: 'api' | 'scrape' | 'portal' | 'manual'
 *    // result.pass2_method: 'api' | 'scrape' | 'portal' | 'manual'
 *
 *    // Batch recon
 *    const batchResult = await reconBatch({
 *      counties: [
 *        { county_id: 123, state: 'TX', county_name: 'Harris' },
 *        { county_id: 456, state: 'FL', county_name: 'Miami-Dade' },
 *      ],
 *      concurrency_limit: 3,
 *    });
 *    ```
 *
 * PRIME RULE:
 * "Claude thinks. Neon remembers. Lovable orchestrates."
 */
