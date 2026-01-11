/**
 * CCA AUDIT & LOGGING SPECIFICATION
 * ADR-022 Compliant — Every Action Must Be Logged
 *
 * DOCTRINE (IMMUTABLE):
 * Every action must log:
 * - county_fips
 * - stage
 * - action
 * - result
 * - confidence_ceiling
 * - timestamp
 * - source (automated | manual)
 */

import {
  ConfidenceCeiling,
  PipelineStage,
  AuditSource,
  CcaAuditLogEntry,
} from './doctrine_types';

// =============================================================================
// AUDIT LOGGER CONFIGURATION
// =============================================================================

export interface AuditLoggerConfig {
  // Sink configuration
  console_enabled: boolean;
  database_enabled: boolean;

  // Filtering
  min_log_level: 'debug' | 'info' | 'warn' | 'error';

  // Retention
  retention_days: number;
}

const DEFAULT_CONFIG: AuditLoggerConfig = {
  console_enabled: true,
  database_enabled: true,
  min_log_level: 'info',
  retention_days: 365, // 1 year
};

// =============================================================================
// AUDIT LOGGER CLASS
// =============================================================================

export class CcaAuditLogger {
  private config: AuditLoggerConfig;
  private buffer: CcaAuditLogEntry[] = [];

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // REQUIRED LOGGING METHODS (per doctrine)
  // ===========================================================================

  /**
   * Log a CCA action (REQUIRED for every action)
   */
  log(
    county_fips: string,
    stage: PipelineStage,
    action: string,
    result: string,
    confidence_ceiling: ConfidenceCeiling,
    source: AuditSource,
    details?: Record<string, unknown>,
    error_message?: string
  ): CcaAuditLogEntry {
    const entry: CcaAuditLogEntry = {
      county_fips,
      stage,
      action,
      result,
      confidence_ceiling,
      timestamp: new Date().toISOString(),
      source,
      details,
      error_message,
    };

    this.buffer.push(entry);

    // Console output
    if (this.config.console_enabled) {
      this.logToConsole(entry);
    }

    return entry;
  }

  /**
   * Log probe action (Stage 1)
   */
  logProbe(
    county_fips: string,
    action: string,
    result: string,
    confidence_ceiling: ConfidenceCeiling,
    details?: Record<string, unknown>
  ): CcaAuditLogEntry {
    return this.log(
      county_fips,
      'probe',
      action,
      result,
      confidence_ceiling,
      'automated',
      details
    );
  }

  /**
   * Log viability scan action (Stage 2)
   */
  logViabilityScan(
    county_fips: string,
    action: string,
    result: string,
    confidence_ceiling: ConfidenceCeiling,
    details?: Record<string, unknown>
  ): CcaAuditLogEntry {
    return this.log(
      county_fips,
      'viability_scan',
      action,
      result,
      confidence_ceiling,
      'automated',
      details
    );
  }

  /**
   * Log constraint hydration action (Stage 3)
   */
  logConstraintHydration(
    county_fips: string,
    action: string,
    result: string,
    confidence_ceiling: ConfidenceCeiling,
    details?: Record<string, unknown>
  ): CcaAuditLogEntry {
    return this.log(
      county_fips,
      'constraint_hydration',
      action,
      result,
      confidence_ceiling,
      'automated',
      details
    );
  }

  /**
   * Log human escalation action (Stage 4)
   */
  logHumanEscalation(
    county_fips: string,
    action: string,
    result: string,
    source: AuditSource,
    details?: Record<string, unknown>
  ): CcaAuditLogEntry {
    // Human escalation always has low confidence until verified
    return this.log(
      county_fips,
      'human_escalation',
      action,
      result,
      'low',
      source,
      details
    );
  }

  /**
   * Log manual verification (Stage 4 completion)
   */
  logManualVerification(
    county_fips: string,
    verified_by: string,
    fields_verified: string[],
    details?: Record<string, unknown>
  ): CcaAuditLogEntry {
    return this.log(
      county_fips,
      'human_escalation',
      'manual_verification',
      'verified',
      'high', // Manual verification allows high confidence
      'manual',
      {
        verified_by,
        fields_verified,
        ...details,
      }
    );
  }

  /**
   * Log kill switch trigger
   */
  logKillSwitch(
    county_fips: string,
    stage: PipelineStage,
    condition_id: string,
    reason: string
  ): CcaAuditLogEntry {
    return this.log(
      county_fips,
      stage,
      'kill_switch_triggered',
      condition_id,
      'low',
      'automated',
      {
        reason,
        condition_id,
      }
    );
  }

  /**
   * Log error
   */
  logError(
    county_fips: string,
    stage: PipelineStage,
    action: string,
    error: Error | string
  ): CcaAuditLogEntry {
    const errorMessage = error instanceof Error ? error.message : error;

    return this.log(
      county_fips,
      stage,
      action,
      'error',
      'low',
      'automated',
      undefined,
      errorMessage
    );
  }

  // ===========================================================================
  // BUFFER MANAGEMENT
  // ===========================================================================

  /**
   * Get all buffered entries
   */
  getBuffer(): CcaAuditLogEntry[] {
    return [...this.buffer];
  }

  /**
   * Flush buffer (for batch database insert)
   */
  flushBuffer(): CcaAuditLogEntry[] {
    const entries = [...this.buffer];
    this.buffer = [];
    return entries;
  }

  /**
   * Clear buffer without returning
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  // ===========================================================================
  // CONSOLE OUTPUT
  // ===========================================================================

  private logToConsole(entry: CcaAuditLogEntry): void {
    const prefix = `[CCA][${entry.stage.toUpperCase()}]`;
    const timestamp = entry.timestamp.substring(11, 19); // HH:MM:SS
    const line = `${prefix} ${timestamp} ${entry.action}: ${entry.result} (${entry.confidence_ceiling})`;

    if (entry.error_message) {
      console.error(line, entry.error_message);
    } else {
      console.log(line);
    }
  }
}

// =============================================================================
// GLOBAL LOGGER INSTANCE
// =============================================================================

let globalLogger: CcaAuditLogger | null = null;

/**
 * Get or create global logger
 */
export function getAuditLogger(): CcaAuditLogger {
  if (!globalLogger) {
    globalLogger = new CcaAuditLogger();
  }
  return globalLogger;
}

/**
 * Initialize global logger with config
 */
export function initAuditLogger(config: Partial<AuditLoggerConfig>): CcaAuditLogger {
  globalLogger = new CcaAuditLogger(config);
  return globalLogger;
}

// =============================================================================
// AUDIT QUERY TYPES
// =============================================================================

export interface AuditQuery {
  county_fips?: string;
  stage?: PipelineStage;
  action?: string;
  source?: AuditSource;
  from_timestamp?: string;
  to_timestamp?: string;
  limit?: number;
}

export interface AuditSummary {
  county_fips: string;
  total_entries: number;
  by_stage: Record<PipelineStage, number>;
  by_result: Record<string, number>;
  last_action_at: string;
  confidence_trend: ConfidenceCeiling[];
}

// =============================================================================
// AUDIT REPORT GENERATION
// =============================================================================

/**
 * Generate audit report for a county
 */
export function generateAuditReport(
  entries: CcaAuditLogEntry[],
  county_fips: string
): AuditSummary {
  const countyEntries = entries.filter((e) => e.county_fips === county_fips);

  const byStage: Record<PipelineStage, number> = {
    probe: 0,
    viability_scan: 0,
    constraint_hydration: 0,
    human_escalation: 0,
  };

  const byResult: Record<string, number> = {};
  const confidenceTrend: ConfidenceCeiling[] = [];

  for (const entry of countyEntries) {
    byStage[entry.stage]++;
    byResult[entry.result] = (byResult[entry.result] || 0) + 1;
    confidenceTrend.push(entry.confidence_ceiling);
  }

  return {
    county_fips,
    total_entries: countyEntries.length,
    by_stage: byStage,
    by_result: byResult,
    last_action_at: countyEntries[countyEntries.length - 1]?.timestamp || '',
    confidence_trend: confidenceTrend,
  };
}

// =============================================================================
// COMPLIANCE VERIFICATION
// =============================================================================

/**
 * Verify audit entry has all required fields
 */
export function verifyAuditCompliance(entry: CcaAuditLogEntry): string[] {
  const violations: string[] = [];

  // DOCTRINE: Every action must log these fields
  if (!entry.county_fips) violations.push('Missing county_fips');
  if (!entry.stage) violations.push('Missing stage');
  if (!entry.action) violations.push('Missing action');
  if (!entry.result) violations.push('Missing result');
  if (!entry.confidence_ceiling) violations.push('Missing confidence_ceiling');
  if (!entry.timestamp) violations.push('Missing timestamp');
  if (!entry.source) violations.push('Missing source');

  return violations;
}

/**
 * Verify all entries in buffer are compliant
 */
export function verifyBufferCompliance(logger: CcaAuditLogger): {
  compliant: boolean;
  violations: Array<{ entry: CcaAuditLogEntry; issues: string[] }>;
} {
  const buffer = logger.getBuffer();
  const violations: Array<{ entry: CcaAuditLogEntry; issues: string[] }> = [];

  for (const entry of buffer) {
    const issues = verifyAuditCompliance(entry);
    if (issues.length > 0) {
      violations.push({ entry, issues });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

// =============================================================================
// DATABASE PERSISTENCE (TYPE DEFINITIONS)
// =============================================================================

/**
 * SQL insert for audit log entry
 */
export function toSqlInsert(entry: CcaAuditLogEntry): {
  sql: string;
  values: unknown[];
} {
  return {
    sql: `
      INSERT INTO ref.cca_audit_log (
        county_fips,
        stage,
        action,
        result,
        confidence_ceiling,
        timestamp,
        source,
        details,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    values: [
      entry.county_fips,
      entry.stage,
      entry.action,
      entry.result,
      entry.confidence_ceiling,
      entry.timestamp,
      entry.source,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.error_message || null,
    ],
  };
}

/**
 * Batch SQL insert for multiple entries
 */
export function toBatchSqlInsert(entries: CcaAuditLogEntry[]): {
  sql: string;
  values: unknown[][];
} {
  const values = entries.map((entry) => [
    entry.county_fips,
    entry.stage,
    entry.action,
    entry.result,
    entry.confidence_ceiling,
    entry.timestamp,
    entry.source,
    entry.details ? JSON.stringify(entry.details) : null,
    entry.error_message || null,
  ]);

  return {
    sql: `
      INSERT INTO ref.cca_audit_log (
        county_fips,
        stage,
        action,
        result,
        confidence_ceiling,
        timestamp,
        source,
        details,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    values,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  DEFAULT_CONFIG as DEFAULT_AUDIT_CONFIG,
};
