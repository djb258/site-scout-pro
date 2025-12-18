/**
 * PASS CONSUMPTION CONTRACTS
 * ADR-022 Compliant — READ-ONLY Access to CCA
 *
 * DOCTRINE:
 * - Pass 0 and Pass 2 may ONLY READ CCA
 * - No pass may WRITE to CCA (only CapabilityProbe writes)
 * - Expired profiles treated as unknown
 * - manual_only counties cap confidence at low
 */

import {
  AutomationClass,
  ConfidenceCeiling,
  Pass0ThrottleResult,
  Pass2RoutingResult,
  CcaAuditLogEntry,
  applyConfidenceCeiling,
} from './doctrine_types';

// =============================================================================
// CCA PROFILE TYPE (READ-ONLY VIEW)
// =============================================================================

export interface CcaProfileReadOnly {
  county_id: number;
  county_fips: string;
  automation_class: AutomationClass | null;
  zoning_model: string;
  permit_system: string;
  document_quality: string;
  automation_viable: boolean;
  confidence_ceiling: ConfidenceCeiling;
  expires_at: string | null;
  manual_verified: boolean;
}

// =============================================================================
// EXPIRATION CHECK
// =============================================================================

function isProfileExpired(profile: CcaProfileReadOnly | null): boolean {
  if (!profile) return true;
  if (!profile.expires_at) return true;
  return new Date(profile.expires_at) < new Date();
}

// =============================================================================
// PASS 0: THROTTLE LOGIC (READ-ONLY)
// =============================================================================

/**
 * Pass 0 throttle contract
 *
 * DOCTRINE RULES:
 * - api/portal_scrape → Full automation allowed
 * - pdf_logs → Weak signal only
 * - manual_only → Human-only signal (low confidence)
 * - unknown → Try cheap probe first
 * - Pass 0 may NOT emit high-confidence signals from manual_only/unknown counties
 */
export function getPass0Throttle(
  profile: CcaProfileReadOnly | null,
  county_fips: string
): Pass0ThrottleResult {
  const auditEntries: CcaAuditLogEntry[] = [];

  // Check 1: Expired profile
  if (isProfileExpired(profile)) {
    logPass0Audit(auditEntries, county_fips, 'throttle_check', 'expired_profile', 'low');
    return {
      allow_full_automation: false,
      confidence_cap: 'low',
      throttle_reason: 'Profile expired',
    };
  }

  // Check 2: No profile
  if (!profile) {
    logPass0Audit(auditEntries, county_fips, 'throttle_check', 'no_profile', 'low');
    return {
      allow_full_automation: false,
      confidence_cap: 'low',
      throttle_reason: 'No capability profile',
    };
  }

  // Check 3: Manual-only county
  // DOCTRINE: manual_only or unknown = ALWAYS cap confidence at low
  if (profile.automation_class === 'manual' || profile.automation_class === null) {
    logPass0Audit(auditEntries, county_fips, 'throttle_check', 'manual_only', 'low');
    return {
      allow_full_automation: false,
      confidence_cap: 'low',
      throttle_reason: 'Manual-only county',
    };
  }

  // Check 4: PDF-based county
  // DOCTRINE: pdf = weak signal only
  if (profile.automation_class === 'pdf') {
    logPass0Audit(auditEntries, county_fips, 'throttle_check', 'pdf_based', 'low');
    return {
      allow_full_automation: false,
      confidence_cap: 'low',
      throttle_reason: 'PDF-based county',
    };
  }

  // Check 5: API or portal = full automation allowed
  if (profile.automation_class === 'api' || profile.automation_class === 'portal') {
    const cap = profile.confidence_ceiling || 'medium';
    logPass0Audit(auditEntries, county_fips, 'throttle_check', 'automation_allowed', cap);
    return {
      allow_full_automation: true,
      confidence_cap: cap,
      throttle_reason: null,
    };
  }

  // Default: low confidence
  logPass0Audit(auditEntries, county_fips, 'throttle_check', 'default', 'low');
  return {
    allow_full_automation: false,
    confidence_cap: 'low',
    throttle_reason: 'Unknown automation class',
  };
}

/**
 * Pass 0: Apply confidence ceiling to signal
 *
 * DOCTRINE: Pass 0 may NOT emit high-confidence signals from manual_only/unknown counties
 */
export function applyPass0ConfidenceCeiling(
  signalConfidence: ConfidenceCeiling,
  profile: CcaProfileReadOnly | null
): ConfidenceCeiling {
  // Get throttle result
  const throttle = getPass0Throttle(profile, profile?.county_fips || 'unknown');

  // Apply ceiling (DOCTRINE: confidence may never be upgraded)
  return applyConfidenceCeiling(signalConfidence, throttle.confidence_cap);
}

// =============================================================================
// PASS 2: ROUTING LOGIC (READ-ONLY)
// =============================================================================

/**
 * Pass 2 routing contract
 *
 * DOCTRINE RULES:
 * - automation_viable = true → Firecrawl scraping
 * - automation_viable = false → Retell voice calls or manual queue
 * - Retell/manual ONLY for non-automatable counties
 * - Expired/missing → do_nothing until probe
 */
export function getPass2Routing(
  profile: CcaProfileReadOnly | null,
  county_fips: string
): Pass2RoutingResult {
  const auditEntries: CcaAuditLogEntry[] = [];

  // Check 1: Expired profile
  if (isProfileExpired(profile)) {
    logPass2Audit(auditEntries, county_fips, 'routing_check', 'expired_profile', 'low');
    return {
      route_to: 'do_nothing',
      confidence_ceiling: 'low',
      routing_reason: 'Profile expired - re-probe required',
    };
  }

  // Check 2: No profile
  if (!profile) {
    logPass2Audit(auditEntries, county_fips, 'routing_check', 'no_profile', 'low');
    return {
      route_to: 'do_nothing',
      confidence_ceiling: 'low',
      routing_reason: 'No capability profile - probe required',
    };
  }

  // Check 3: Automation viable
  if (profile.automation_viable) {
    const ceiling = profile.confidence_ceiling || 'medium';
    logPass2Audit(auditEntries, county_fips, 'routing_check', 'firecrawl', ceiling);
    return {
      route_to: 'firecrawl',
      confidence_ceiling: ceiling,
      routing_reason: 'Automation viable',
    };
  }

  // Check 4: Manual-only county → Retell
  // DOCTRINE: Retell/manual ONLY allowed if automation not viable
  if (profile.automation_class === 'manual') {
    logPass2Audit(auditEntries, county_fips, 'routing_check', 'retell', 'low');
    return {
      route_to: 'retell',
      confidence_ceiling: 'low',
      routing_reason: 'Manual-only county',
    };
  }

  // Check 5: Scanned PDF → manual queue
  if (profile.document_quality === 'scanned_pdf') {
    logPass2Audit(auditEntries, county_fips, 'routing_check', 'manual_queue', 'low');
    return {
      route_to: 'manual_queue',
      confidence_ceiling: 'low',
      routing_reason: 'Scanned PDF documents',
    };
  }

  // Default: manual queue
  logPass2Audit(auditEntries, county_fips, 'routing_check', 'manual_queue_default', 'low');
  return {
    route_to: 'manual_queue',
    confidence_ceiling: 'low',
    routing_reason: 'Not automation viable',
  };
}

/**
 * Pass 2: Check if hydration should proceed
 *
 * DOCTRINE: "do_nothing" cases must be explicit
 */
export function shouldPass2Proceed(
  profile: CcaProfileReadOnly | null
): { proceed: boolean; reason: string } {
  if (isProfileExpired(profile)) {
    return { proceed: false, reason: 'Profile expired - trigger re-probe' };
  }

  if (!profile) {
    return { proceed: false, reason: 'No profile - trigger probe' };
  }

  return { proceed: true, reason: 'Profile valid' };
}

// =============================================================================
// EXPLICIT "DO NOTHING" CASES
// =============================================================================

/**
 * Document all "do nothing" conditions for audit
 */
export interface DoNothingCase {
  condition: string;
  pass: 'pass0' | 'pass2';
  action: 'do_nothing';
  next_step: string;
}

export const DO_NOTHING_CASES: DoNothingCase[] = [
  {
    condition: 'Profile expired',
    pass: 'pass0',
    action: 'do_nothing',
    next_step: 'Trigger CapabilityProbe re-probe',
  },
  {
    condition: 'No profile exists',
    pass: 'pass0',
    action: 'do_nothing',
    next_step: 'Trigger CapabilityProbe probe',
  },
  {
    condition: 'Profile expired',
    pass: 'pass2',
    action: 'do_nothing',
    next_step: 'Wait for re-probe before hydration',
  },
  {
    condition: 'No profile exists',
    pass: 'pass2',
    action: 'do_nothing',
    next_step: 'Wait for probe before hydration',
  },
  {
    condition: 'Retry limit exceeded',
    pass: 'pass2',
    action: 'do_nothing',
    next_step: 'Trigger human escalation',
  },
];

// =============================================================================
// AUDIT HELPERS
// =============================================================================

function logPass0Audit(
  entries: CcaAuditLogEntry[],
  county_fips: string,
  action: string,
  result: string,
  confidence: ConfidenceCeiling
): void {
  entries.push({
    county_fips,
    stage: 'viability_scan', // Pass 0 uses viability scan stage
    action,
    result,
    confidence_ceiling: confidence,
    timestamp: new Date().toISOString(),
    source: 'automated',
  });
}

function logPass2Audit(
  entries: CcaAuditLogEntry[],
  county_fips: string,
  action: string,
  result: string,
  confidence: ConfidenceCeiling
): void {
  entries.push({
    county_fips,
    stage: 'constraint_hydration', // Pass 2 uses constraint hydration stage
    action,
    result,
    confidence_ceiling: confidence,
    timestamp: new Date().toISOString(),
    source: 'automated',
  });
}

// =============================================================================
// PASS INTEGRATION TYPES
// =============================================================================

/**
 * Pass 0 signal with CCA enforcement
 */
export interface Pass0SignalWithCca {
  original_confidence: ConfidenceCeiling;
  cca_ceiling: ConfidenceCeiling;
  effective_confidence: ConfidenceCeiling;
  was_capped: boolean;
}

/**
 * Enforce CCA ceiling on Pass 0 signal
 */
export function enforcePass0CcaCeiling(
  signalConfidence: ConfidenceCeiling,
  profile: CcaProfileReadOnly | null
): Pass0SignalWithCca {
  const effectiveConfidence = applyPass0ConfidenceCeiling(signalConfidence, profile);
  const throttle = getPass0Throttle(profile, profile?.county_fips || 'unknown');

  return {
    original_confidence: signalConfidence,
    cca_ceiling: throttle.confidence_cap,
    effective_confidence: effectiveConfidence,
    was_capped: effectiveConfidence !== signalConfidence,
  };
}
