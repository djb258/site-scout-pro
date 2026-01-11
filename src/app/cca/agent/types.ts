/**
 * CCA Recon Agent Types
 * ============================================================================
 *
 * DOCTRINE:
 * The CCA Recon Agent determines the MOST AUTOMATABLE WAY to collect
 * county-level information for Pass 0 and Pass 2.
 *
 * It does NOT collect permit data, zoning data, or metrics.
 * It ONLY collects capability and method.
 *
 * ============================================================================
 */

// =============================================================================
// AUTOMATION METHOD
// =============================================================================

/**
 * Automation methods in strict priority order.
 * Agent MUST pick highest viable method: API → Scrape → Portal → Manual
 */
export type AutomationMethod = 'api' | 'scrape' | 'portal' | 'manual';

/**
 * Priority order for automation selection.
 * Lower number = higher priority.
 */
export const AUTOMATION_PRIORITY: Record<AutomationMethod, number> = {
  api: 1,
  scrape: 2,
  portal: 3,
  manual: 4,
};

// =============================================================================
// COVERAGE
// =============================================================================

/**
 * Coverage level for the selected method.
 */
export type CoverageLevel = 'full' | 'partial' | 'insufficient';

// =============================================================================
// CONFIDENCE
// =============================================================================

/**
 * Confidence in the assessment.
 * - high: Verified with multiple sources, method tested
 * - medium: Single reliable source, method likely works
 * - low: Limited evidence, method uncertain
 */
export type ReconConfidence = 'low' | 'medium' | 'high';

// =============================================================================
// INPUT
// =============================================================================

/**
 * Input payload for a single county.
 */
export interface CcaReconInput {
  /** Immutable unique identifier */
  county_id: number;

  /** State code (e.g., 'TX', 'FL') */
  state: string;

  /** County name (e.g., 'Harris', 'Miami-Dade') */
  county_name: string;
}

/**
 * Batch input for multiple counties.
 */
export interface CcaReconBatchInput {
  counties: CcaReconInput[];

  /** Optional: limit concurrent probes */
  concurrency_limit?: number;

  /** Optional: timeout per county in ms */
  timeout_per_county_ms?: number;
}

// =============================================================================
// OUTPUT
// =============================================================================

/**
 * Output for a single county.
 * This is the structured JSON that downstream systems consume.
 */
export interface CcaReconOutput {
  /** Immutable unique identifier */
  county_id: number;

  /** State code */
  state: string;

  /** County name */
  county_name: string;

  // ---------------------------------------------------------------------------
  // PASS 0 (Permits & Inspections - ongoing)
  // ---------------------------------------------------------------------------

  /** Best automation method for Pass 0 */
  pass0_method: AutomationMethod;

  /** URL or system identifier for Pass 0 source */
  pass0_source_pointer: string;

  /** Coverage level for Pass 0 */
  pass0_coverage: CoverageLevel;

  /** Notes about Pass 0 capability */
  pass0_notes: string;

  // ---------------------------------------------------------------------------
  // PASS 2 (Jurisdiction / Static Facts - one-time or annual)
  // ---------------------------------------------------------------------------

  /** Best automation method for Pass 2 */
  pass2_method: AutomationMethod;

  /** URL or system identifier for Pass 2 source */
  pass2_source_pointer: string;

  /** Coverage level for Pass 2 */
  pass2_coverage: CoverageLevel;

  /** Notes about Pass 2 capability */
  pass2_notes: string;

  // ---------------------------------------------------------------------------
  // META
  // ---------------------------------------------------------------------------

  /** Overall confidence in this assessment */
  confidence: ReconConfidence;

  /** Evidence links that support this assessment */
  evidence_links: string[];

  /** ISO timestamp of verification */
  verified_at: string;
}

/**
 * Batch output for multiple counties.
 */
export interface CcaReconBatchOutput {
  /** Successfully probed counties */
  results: CcaReconOutput[];

  /** Counties that failed probing */
  failures: Array<{
    county_id: number;
    state: string;
    county_name: string;
    error: string;
  }>;

  /** Batch metadata */
  meta: {
    total_input: number;
    total_success: number;
    total_failed: number;
    started_at: string;
    completed_at: string;
    duration_ms: number;
  };
}

// =============================================================================
// AGENT STATUS
// =============================================================================

export type AgentStatus = 'idle' | 'probing' | 'completed' | 'failed';

export interface AgentProgress {
  status: AgentStatus;
  current_county: string | null;
  completed: number;
  total: number;
  failures: number;
}
