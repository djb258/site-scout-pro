/**
 * CCA KILL SWITCH LOGIC
 * ADR-022 Compliant — Pipeline Stop Conditions
 *
 * DOCTRINE:
 * - Pipeline MUST stop under specific conditions
 * - All stops MUST be logged
 * - No silent failures
 */

import {
  ConfidenceCeiling,
  PipelineStage,
  KillSwitchResult,
  CcaAuditLogEntry,
} from './doctrine_types';
import { CcaProfileReadOnly } from './PassConsumptionContracts';

// =============================================================================
// KILL SWITCH CONDITIONS (LOCKED)
// =============================================================================

export interface KillCondition {
  id: string;
  stage: PipelineStage;
  condition: string;
  check: (profile: CcaProfileReadOnly | null, context: KillSwitchContext) => boolean;
  reason: string;
  next_action: string;
}

export interface KillSwitchContext {
  county_fips: string;
  retry_count: number;
  max_retries: number;
  geometry_blocked: boolean;
  required_fields_missing: string[];
}

// =============================================================================
// KILL CONDITIONS REGISTRY
// =============================================================================

const KILL_CONDITIONS: KillCondition[] = [
  // Stage 1: Probe
  {
    id: 'K001',
    stage: 'probe',
    condition: 'Profile expired',
    check: (profile) => {
      if (!profile) return true;
      if (!profile.expires_at) return true;
      return new Date(profile.expires_at) < new Date();
    },
    reason: 'Profile expired - re-probe required',
    next_action: 'Trigger CapabilityProbe',
  },
  {
    id: 'K002',
    stage: 'probe',
    condition: 'No profile exists',
    check: (profile) => profile === null,
    reason: 'No capability profile - probe required',
    next_action: 'Trigger CapabilityProbe',
  },
  {
    id: 'K003',
    stage: 'probe',
    condition: 'Retry limit exceeded',
    check: (_, context) => context.retry_count >= context.max_retries,
    reason: 'Probe retry limit exceeded - human escalation required',
    next_action: 'Trigger human escalation',
  },

  // Stage 2: Viability Scan
  {
    id: 'K101',
    stage: 'viability_scan',
    condition: 'Manual-only county without verification',
    check: (profile) => {
      if (!profile) return false;
      return profile.automation_class === 'manual' && !profile.manual_verified;
    },
    reason: 'Manual-only county requires human verification',
    next_action: 'Route to human verification queue',
  },

  // Stage 3: Constraint Hydration
  {
    id: 'K201',
    stage: 'constraint_hydration',
    condition: 'Geometry blocked with missing required fields',
    check: (_, context) => {
      return context.geometry_blocked && context.required_fields_missing.length > 0;
    },
    reason: 'Geometry blocked - required fields unknown',
    next_action: 'Trigger human escalation for missing fields',
  },
];

// =============================================================================
// KILL SWITCH CHECK
// =============================================================================

/**
 * Check if pipeline should be killed
 *
 * Returns first matching kill condition or null if pipeline should continue
 */
export function checkKillSwitch(
  profile: CcaProfileReadOnly | null,
  context: KillSwitchContext
): KillSwitchResult {
  const auditEntries: CcaAuditLogEntry[] = [];

  for (const condition of KILL_CONDITIONS) {
    if (condition.check(profile, context)) {
      // Log the kill
      logKillSwitch(auditEntries, context.county_fips, condition);

      return {
        should_kill: true,
        kill_reason: condition.reason,
        stage: condition.stage,
      };
    }
  }

  // No kill condition met
  return {
    should_kill: false,
    kill_reason: null,
    stage: null,
  };
}

/**
 * Check kill switch for specific stage only
 */
export function checkKillSwitchForStage(
  profile: CcaProfileReadOnly | null,
  context: KillSwitchContext,
  stage: PipelineStage
): KillSwitchResult {
  const auditEntries: CcaAuditLogEntry[] = [];

  const stageConditions = KILL_CONDITIONS.filter((c) => c.stage === stage);

  for (const condition of stageConditions) {
    if (condition.check(profile, context)) {
      logKillSwitch(auditEntries, context.county_fips, condition);

      return {
        should_kill: true,
        kill_reason: condition.reason,
        stage: condition.stage,
      };
    }
  }

  return {
    should_kill: false,
    kill_reason: null,
    stage: null,
  };
}

// =============================================================================
// KILL SWITCH ACTIONS
// =============================================================================

export type KillAction =
  | 'trigger_probe'
  | 'trigger_human_escalation'
  | 'route_to_manual_queue'
  | 'halt_pipeline';

/**
 * Get the action to take when pipeline is killed
 */
export function getKillAction(result: KillSwitchResult): KillAction {
  if (!result.should_kill) {
    return 'halt_pipeline'; // Should not happen
  }

  switch (result.stage) {
    case 'probe':
      if (result.kill_reason?.includes('retry limit')) {
        return 'trigger_human_escalation';
      }
      return 'trigger_probe';

    case 'viability_scan':
      return 'route_to_manual_queue';

    case 'constraint_hydration':
      return 'trigger_human_escalation';

    case 'human_escalation':
      return 'halt_pipeline';

    default:
      return 'halt_pipeline';
  }
}

// =============================================================================
// KILL SWITCH LOGGING
// =============================================================================

function logKillSwitch(
  entries: CcaAuditLogEntry[],
  county_fips: string,
  condition: KillCondition
): void {
  entries.push({
    county_fips,
    stage: condition.stage,
    action: 'kill_switch_triggered',
    result: condition.id,
    confidence_ceiling: 'low',
    timestamp: new Date().toISOString(),
    source: 'automated',
    details: {
      condition_id: condition.id,
      condition_description: condition.condition,
      reason: condition.reason,
      next_action: condition.next_action,
    },
  });
}

// =============================================================================
// KILL SWITCH REPORT
// =============================================================================

export interface KillSwitchReport {
  county_fips: string;
  checked_at: string;
  conditions_checked: number;
  result: KillSwitchResult;
  recommended_action: KillAction;
}

/**
 * Generate full kill switch report
 */
export function generateKillSwitchReport(
  profile: CcaProfileReadOnly | null,
  context: KillSwitchContext
): KillSwitchReport {
  const result = checkKillSwitch(profile, context);

  return {
    county_fips: context.county_fips,
    checked_at: new Date().toISOString(),
    conditions_checked: KILL_CONDITIONS.length,
    result,
    recommended_action: result.should_kill ? getKillAction(result) : 'halt_pipeline',
  };
}

// =============================================================================
// PIPELINE STAGE GATES
// =============================================================================

/**
 * Gate before Stage 1 (Probe)
 */
export function gateStage1Probe(
  profile: CcaProfileReadOnly | null,
  context: KillSwitchContext
): { proceed: boolean; reason: string } {
  const result = checkKillSwitchForStage(profile, context, 'probe');

  if (result.should_kill) {
    return {
      proceed: false,
      reason: result.kill_reason || 'Kill switch triggered',
    };
  }

  return { proceed: true, reason: 'Gate passed' };
}

/**
 * Gate before Stage 2 (Viability Scan)
 */
export function gateStage2ViabilityScan(
  profile: CcaProfileReadOnly | null,
  context: KillSwitchContext
): { proceed: boolean; reason: string } {
  // Must have valid profile to proceed
  if (!profile || new Date(profile.expires_at || 0) < new Date()) {
    return {
      proceed: false,
      reason: 'Invalid or expired profile - cannot proceed to viability scan',
    };
  }

  const result = checkKillSwitchForStage(profile, context, 'viability_scan');

  if (result.should_kill) {
    return {
      proceed: false,
      reason: result.kill_reason || 'Kill switch triggered',
    };
  }

  return { proceed: true, reason: 'Gate passed' };
}

/**
 * Gate before Stage 3 (Constraint Hydration)
 */
export function gateStage3ConstraintHydration(
  profile: CcaProfileReadOnly | null,
  context: KillSwitchContext
): { proceed: boolean; reason: string } {
  // DOCTRINE: Only triggered when geometry_blocked = true
  if (!context.geometry_blocked) {
    return {
      proceed: false,
      reason: 'Geometry not blocked - constraint hydration not needed',
    };
  }

  const result = checkKillSwitchForStage(profile, context, 'constraint_hydration');

  if (result.should_kill) {
    return {
      proceed: false,
      reason: result.kill_reason || 'Kill switch triggered',
    };
  }

  return { proceed: true, reason: 'Gate passed' };
}

/**
 * Gate before Stage 4 (Human Escalation)
 */
export function gateStage4HumanEscalation(
  context: KillSwitchContext
): { proceed: boolean; reason: string } {
  // DOCTRINE: Triggered ONLY when:
  // geometry_blocked = true AND required field remains unknown

  if (!context.geometry_blocked) {
    return {
      proceed: false,
      reason: 'Geometry not blocked - human escalation not needed',
    };
  }

  if (context.required_fields_missing.length === 0) {
    return {
      proceed: false,
      reason: 'No required fields missing - human escalation not needed',
    };
  }

  return {
    proceed: true,
    reason: `Human escalation needed for: ${context.required_fields_missing.join(', ')}`,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { KILL_CONDITIONS };
