/**
 * DoctrineEnforcer Spoke (SS.05.02)
 *
 * Enforces doctrine compliance before verdict.
 * Checks for anchor violations, boundary violations, and constraint breaches.
 *
 * @module SubHub5_DealGate/spokes/DoctrineEnforcer
 */

import {
  DoctrineEnforcerResult,
  DoctrineViolation,
  createStubDoctrineEnforcer,
  createErrorResult,
} from '../types/pass5_types';

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface DoctrineEnforcerInput {
  /** SVA reference (must exist) */
  svaId: string;
  /** Parcel ID (must exist) */
  parcelId: string;
  /** ZIP anchor */
  zipAnchor?: string;
  /** County FIPS anchor */
  countyFipsAnchor?: string;
  /** Pipeline completion status */
  pipelineStatus?: {
    subhub0Complete?: boolean;
    subhub1Complete?: boolean;
    subhub2Complete?: boolean;
    subhub3Complete?: boolean;
    subhub4Complete?: boolean;
  };
  /** Data integrity flags */
  dataIntegrity?: {
    parcelZipMatchesSearch?: boolean;
    parcelFipsMatchesJurisdiction?: boolean;
    svaHasValidIntent?: boolean;
  };
}

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Enforce doctrine compliance
 */
export async function runDoctrineEnforcer(
  input: DoctrineEnforcerInput
): Promise<DoctrineEnforcerResult> {
  try {
    console.log(`[DOCTRINE_ENFORCER] Checking compliance for SVA ${input.svaId}...`);

    const violations: DoctrineViolation[] = [];

    // Check anchor violations
    checkAnchorViolations(input, violations);

    // Check pipeline violations
    checkPipelineViolations(input, violations);

    // Check data integrity violations
    checkDataIntegrityViolations(input, violations);

    // Count by severity
    const hardViolations = violations.filter((v) => v.severity === 'HARD').length;
    const softViolations = violations.filter((v) => v.severity === 'SOFT').length;

    // Compliant if no HARD violations
    const compliant = hardViolations === 0;

    return {
      status: 'ok',
      compliant,
      violations,
      hardViolations,
      softViolations,
      notes: compliant
        ? `Doctrine compliant${softViolations > 0 ? ` (${softViolations} soft violations)` : ''}`
        : `Non-compliant: ${hardViolations} hard violations`,
    };
  } catch (error) {
    console.error('[DOCTRINE_ENFORCER] Error:', error);
    return createErrorResult(error as Error, createStubDoctrineEnforcer);
  }
}

// ============================================================================
// VIOLATION CHECKS
// ============================================================================

function checkAnchorViolations(
  input: DoctrineEnforcerInput,
  violations: DoctrineViolation[]
): void {
  // SVA anchor required
  if (!input.svaId || input.svaId.trim() === '') {
    violations.push({
      code: 'ANCHOR_SVA_MISSING',
      severity: 'HARD',
      description: 'SVA (Sovereign ID) anchor is missing',
      remediation: 'Mint SVA before entering DealGate',
    });
  } else if (!input.svaId.startsWith('SVA-')) {
    violations.push({
      code: 'ANCHOR_SVA_INVALID',
      severity: 'HARD',
      description: `SVA format invalid: ${input.svaId}`,
      remediation: 'SVA must follow format SVA-{TIMESTAMP}-{USER_ID}-{RANDOM}',
    });
  }

  // Parcel ID anchor required
  if (!input.parcelId || input.parcelId.trim() === '') {
    violations.push({
      code: 'ANCHOR_PARCEL_MISSING',
      severity: 'HARD',
      description: 'Parcel ID anchor is missing',
      remediation: 'Parcel must be promoted through SubHub4 before DealGate',
    });
  } else if (!input.parcelId.includes('-')) {
    violations.push({
      code: 'ANCHOR_PARCEL_INVALID',
      severity: 'HARD',
      description: `Parcel ID format invalid: ${input.parcelId}`,
      remediation: 'Parcel ID must follow format {FIPS}-{APN}',
    });
  }

  // ZIP anchor (soft check - should be present but not blocking)
  if (!input.zipAnchor) {
    violations.push({
      code: 'ANCHOR_ZIP_MISSING',
      severity: 'SOFT',
      description: 'ZIP anchor not provided for traceability',
      remediation: 'Include ZIP anchor for full audit trail',
    });
  }

  // County FIPS anchor (soft check)
  if (!input.countyFipsAnchor) {
    violations.push({
      code: 'ANCHOR_FIPS_MISSING',
      severity: 'SOFT',
      description: 'County FIPS anchor not provided',
      remediation: 'Include County FIPS anchor for jurisdiction traceability',
    });
  }
}

function checkPipelineViolations(
  input: DoctrineEnforcerInput,
  violations: DoctrineViolation[]
): void {
  const status = input.pipelineStatus ?? {};

  // All upstream SubHubs must be complete
  if (!status.subhub0Complete) {
    violations.push({
      code: 'PIPELINE_SUBHUB0_INCOMPLETE',
      severity: 'SOFT',
      description: 'SubHub0_Signals not completed',
      remediation: 'Complete signals analysis before verdict',
    });
  }

  if (!status.subhub1Complete) {
    violations.push({
      code: 'PIPELINE_SUBHUB1_INCOMPLETE',
      severity: 'HARD',
      description: 'SubHub1_Market not completed',
      remediation: 'Market analysis required before verdict',
    });
  }

  if (!status.subhub2Complete) {
    violations.push({
      code: 'PIPELINE_SUBHUB2_INCOMPLETE',
      severity: 'HARD',
      description: 'SubHub2_CountyCard not completed',
      remediation: 'Jurisdiction rules required before verdict',
    });
  }

  if (!status.subhub3Complete) {
    violations.push({
      code: 'PIPELINE_SUBHUB3_INCOMPLETE',
      severity: 'HARD',
      description: 'SubHub3_Calculators not completed',
      remediation: 'Feasibility calculations required before verdict',
    });
  }

  if (!status.subhub4Complete) {
    violations.push({
      code: 'PIPELINE_SUBHUB4_INCOMPLETE',
      severity: 'HARD',
      description: 'SubHub4_ParcelDiscovery not completed',
      remediation: 'Parcel must be promoted through discovery before verdict',
    });
  }
}

function checkDataIntegrityViolations(
  input: DoctrineEnforcerInput,
  violations: DoctrineViolation[]
): void {
  const integrity = input.dataIntegrity ?? {};

  // Parcel ZIP must match search anchor
  if (integrity.parcelZipMatchesSearch === false) {
    violations.push({
      code: 'DATA_ZIP_MISMATCH',
      severity: 'HARD',
      description: 'Parcel ZIP does not match search anchor',
      remediation: 'Parcel must be within the ZIP-bounded search scope',
    });
  }

  // Parcel FIPS must match jurisdiction
  if (integrity.parcelFipsMatchesJurisdiction === false) {
    violations.push({
      code: 'DATA_FIPS_MISMATCH',
      severity: 'HARD',
      description: 'Parcel FIPS does not match jurisdiction anchor',
      remediation: 'Parcel must be within the jurisdiction scope',
    });
  }

  // SVA must have valid intent
  if (integrity.svaHasValidIntent === false) {
    violations.push({
      code: 'DATA_SVA_INTENT_INVALID',
      severity: 'HARD',
      description: 'SVA does not have valid intent data',
      remediation: 'SVA must be minted with valid search intent',
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runDoctrineEnforcer;
