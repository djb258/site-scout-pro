/**
 * CCA DOCTRINE-LOCKED EXPORTS
 * ADR-022 Compliant
 *
 * This file exports all doctrine-locked CCA components.
 * DO NOT modify without doctrine review.
 */

// =============================================================================
// DOCTRINE TYPES
// =============================================================================

export {
  // Enums
  AutomationClass,
  ZoningModelV2,
  ConfidenceCeiling,
  PipelineStage,
  AuditSource,

  // Stage 1 types
  CapabilityProbeInput,
  CapabilityProbeOutput,

  // Stage 2 types
  ThinViabilityScanOutput,

  // Stage 3 types
  CitedConstraint,
  ConstraintHydrationOutput,

  // Stage 4 types
  HumanEscalationRequest,
  HumanVerificationResult,

  // Audit types
  CcaAuditLogEntry,

  // Kill switch types
  KillSwitchResult,

  // Pass consumption types
  Pass0ThrottleResult,
  Pass2RoutingResult,

  // Helpers
  applyConfidenceCeiling,
  isConfidenceUpgradeAttempt,
  validateProbeOutput,
  validateCitedConstraint,

  // Constants
  TTL_MONTHS,
  TTL_MS,
  DEFAULT_PROBE_OUTPUT,
  DEFAULT_VIABILITY_SCAN,
} from './doctrine_types';

// =============================================================================
// CAPABILITY PROBE (Stage 1)
// =============================================================================

export {
  runCapabilityProbe,
  runCapabilityProbeWithRetry,
  shouldRetryProbe,
  PROBE_CONFIG,
  VENDOR_PATTERNS,
  NO_ZONING_INDICATORS,
} from './DoctrineLocked_CapabilityProbe';

// =============================================================================
// PASS CONSUMPTION CONTRACTS
// =============================================================================

export {
  // Types
  CcaProfileReadOnly,

  // Pass 0
  getPass0Throttle,
  applyPass0ConfidenceCeiling,
  enforcePass0CcaCeiling,
  Pass0SignalWithCca,

  // Pass 2
  getPass2Routing,
  shouldPass2Proceed,

  // Do nothing cases
  DO_NOTHING_CASES,
  DoNothingCase,
} from './PassConsumptionContracts';

// =============================================================================
// KILL SWITCH LOGIC
// =============================================================================

export {
  // Types
  KillCondition,
  KillSwitchContext,
  KillAction,
  KillSwitchReport,

  // Functions
  checkKillSwitch,
  checkKillSwitchForStage,
  getKillAction,
  generateKillSwitchReport,

  // Stage gates
  gateStage1Probe,
  gateStage2ViabilityScan,
  gateStage3ConstraintHydration,
  gateStage4HumanEscalation,

  // Registry
  KILL_CONDITIONS,
} from './KillSwitchLogic';

// =============================================================================
// AUDIT LOGGER
// =============================================================================

export {
  // Logger class
  CcaAuditLogger,
  AuditLoggerConfig,

  // Global logger
  getAuditLogger,
  initAuditLogger,

  // Query types
  AuditQuery,
  AuditSummary,

  // Report generation
  generateAuditReport,

  // Compliance
  verifyAuditCompliance,
  verifyBufferCompliance,

  // Database persistence
  toSqlInsert,
  toBatchSqlInsert,

  // Config
  DEFAULT_AUDIT_CONFIG,
} from './AuditLogger';
