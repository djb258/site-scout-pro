/**
 * MASTER FAILURE HUB
 *
 * Centralized failure tracking and reporting system following IMO-RA architecture.
 * Aggregates failures from Pass-1 and Pass-2 hubs, triggers alerts, and enables auto-repair.
 *
 * Based on: imo-creator/global-config/global_manifest.yaml
 * Doctrine ID: SS.00.FL
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';
export type ResolutionStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_repaired';

export interface FailureEvent {
  /** Unique failure event ID */
  id: string;
  /** Hub where failure originated (e.g., PASS1_RECON_HUB, PASS2_UNDERWRITING_HUB) */
  sourceHub: string;
  /** Sub-hub/spoke if applicable (e.g., ZIP_HYDRATION, FEASIBILITY) */
  subHub?: string;
  /** Failure code from hub definition */
  failureType: string;
  /** When failure occurred */
  timestamp: string;
  /** Severity level */
  severity: SeverityLevel;
  /** Current resolution status */
  resolutionStatus: ResolutionStatus;
  /** Whether auto-repair was attempted */
  autoRepairTriggered: boolean;
  /** HEIR tracking ID */
  uniqueId?: string;
  /** ORBT process ID */
  processId?: string;
  /** Human-readable error message */
  message: string;
  /** Additional context/metadata */
  context?: Record<string, unknown>;
  /** Stack trace if available */
  stackTrace?: string;
}

export interface FailureReport {
  sourceHub: string;
  subHub?: string;
  failureType: string;
  severity: SeverityLevel;
  message: string;
  context?: Record<string, unknown>;
  stackTrace?: string;
}

export interface FailureQuery {
  sourceHub?: string;
  subHub?: string;
  severity?: SeverityLevel | SeverityLevel[];
  status?: ResolutionStatus | ResolutionStatus[];
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

export interface FailureStats {
  total: number;
  bySeverity: Record<SeverityLevel, number>;
  byStatus: Record<ResolutionStatus, number>;
  byHub: Record<string, number>;
  autoRepairSuccessRate: number;
  meanTimeToResolution: number;
}

export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
}

export interface AutoRepairConfig {
  enabled: boolean;
  triggerOn: SeverityLevel[];
  cooldownSeconds: number;
  handlers: Map<string, AutoRepairHandler>;
}

export type AutoRepairHandler = (failure: FailureEvent) => Promise<boolean>;

// ============================================================================
// SEVERITY CONFIGURATION
// ============================================================================

const SEVERITY_CONFIG: Record<SeverityLevel, { priority: number; alerting: boolean; autoRepair: boolean }> = {
  info: { priority: 4, alerting: false, autoRepair: false },
  warning: { priority: 3, alerting: true, autoRepair: false },
  error: { priority: 2, alerting: true, autoRepair: true },
  critical: { priority: 1, alerting: true, autoRepair: true },
};

const ESCALATION_CONFIG = {
  warningToError: { afterMinutes: 30, ifUnresolved: true },
  errorToCritical: { afterMinutes: 60, ifUnresolved: true },
};

// ============================================================================
// MASTER FAILURE HUB CLASS
// ============================================================================

class MasterFailureHubClass {
  private failures: Map<string, FailureEvent> = new Map();
  private alertHandlers: ((failure: FailureEvent) => void)[] = [];
  private autoRepairHandlers: Map<string, AutoRepairHandler> = new Map();
  private cooldowns: Map<string, number> = new Map();

  private retryPolicy: RetryPolicy = {
    enabled: true,
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelayMs: 1000,
  };

  private autoRepairConfig: AutoRepairConfig = {
    enabled: true,
    triggerOn: ['error', 'critical'],
    cooldownSeconds: 300,
    handlers: new Map(),
  };

  /**
   * Report a new failure event.
   */
  async report(report: FailureReport): Promise<FailureEvent> {
    const id = this.generateId();
    const timestamp = new Date().toISOString();

    const failure: FailureEvent = {
      id,
      sourceHub: report.sourceHub,
      subHub: report.subHub,
      failureType: report.failureType,
      timestamp,
      severity: report.severity,
      resolutionStatus: 'open',
      autoRepairTriggered: false,
      message: report.message,
      context: report.context,
      stackTrace: report.stackTrace,
    };

    this.failures.set(id, failure);

    console.log(
      `[MASTER_FAILURE_HUB] Failure reported: ${failure.failureType} in ${failure.sourceHub}${failure.subHub ? '/' + failure.subHub : ''} (${failure.severity})`
    );

    // Trigger alerts if configured
    if (SEVERITY_CONFIG[failure.severity].alerting) {
      this.triggerAlerts(failure);
    }

    // Attempt auto-repair if configured
    if (this.shouldAutoRepair(failure)) {
      await this.attemptAutoRepair(failure);
    }

    return failure;
  }

  /**
   * Query failures with filters.
   */
  query(filters: FailureQuery): FailureEvent[] {
    let results = Array.from(this.failures.values());

    if (filters.sourceHub) {
      results = results.filter((f) => f.sourceHub === filters.sourceHub);
    }

    if (filters.subHub) {
      results = results.filter((f) => f.subHub === filters.subHub);
    }

    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      results = results.filter((f) => severities.includes(f.severity));
    }

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      results = results.filter((f) => statuses.includes(f.resolutionStatus));
    }

    if (filters.fromTimestamp) {
      results = results.filter((f) => f.timestamp >= filters.fromTimestamp!);
    }

    if (filters.toTimestamp) {
      results = results.filter((f) => f.timestamp <= filters.toTimestamp!);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get failure by ID.
   */
  get(id: string): FailureEvent | undefined {
    return this.failures.get(id);
  }

  /**
   * Update failure status.
   */
  updateStatus(id: string, status: ResolutionStatus): FailureEvent | undefined {
    const failure = this.failures.get(id);
    if (failure) {
      failure.resolutionStatus = status;
      console.log(`[MASTER_FAILURE_HUB] Failure ${id} status updated to: ${status}`);
    }
    return failure;
  }

  /**
   * Get failure statistics.
   */
  getStats(): FailureStats {
    const failures = Array.from(this.failures.values());

    const bySeverity: Record<SeverityLevel, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byStatus: Record<ResolutionStatus, number> = {
      open: 0,
      acknowledged: 0,
      in_progress: 0,
      resolved: 0,
      auto_repaired: 0,
    };

    const byHub: Record<string, number> = {};

    let autoRepairAttempts = 0;
    let autoRepairSuccesses = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const failure of failures) {
      bySeverity[failure.severity]++;
      byStatus[failure.resolutionStatus]++;
      byHub[failure.sourceHub] = (byHub[failure.sourceHub] || 0) + 1;

      if (failure.autoRepairTriggered) {
        autoRepairAttempts++;
        if (failure.resolutionStatus === 'auto_repaired') {
          autoRepairSuccesses++;
        }
      }

      if (failure.resolutionStatus === 'resolved' || failure.resolutionStatus === 'auto_repaired') {
        // Estimate resolution time (would need resolvedAt timestamp in production)
        resolvedCount++;
      }
    }

    return {
      total: failures.length,
      bySeverity,
      byStatus,
      byHub,
      autoRepairSuccessRate: autoRepairAttempts > 0 ? autoRepairSuccesses / autoRepairAttempts : 0,
      meanTimeToResolution: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    };
  }

  /**
   * Get system health status.
   */
  getHealth(): { status: 'healthy' | 'degraded' | 'critical'; openFailures: number; criticalCount: number } {
    const failures = Array.from(this.failures.values());
    const openFailures = failures.filter(
      (f) => f.resolutionStatus === 'open' || f.resolutionStatus === 'acknowledged' || f.resolutionStatus === 'in_progress'
    );
    const criticalCount = openFailures.filter((f) => f.severity === 'critical').length;
    const errorCount = openFailures.filter((f) => f.severity === 'error').length;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalCount > 0) {
      status = 'critical';
    } else if (errorCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      openFailures: openFailures.length,
      criticalCount,
    };
  }

  /**
   * Register an alert handler.
   */
  onAlert(handler: (failure: FailureEvent) => void): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Register an auto-repair handler for a specific failure type.
   */
  registerAutoRepair(failureType: string, handler: AutoRepairHandler): void {
    this.autoRepairHandlers.set(failureType, handler);
  }

  /**
   * Clear all failures (for testing).
   */
  clear(): void {
    this.failures.clear();
    this.cooldowns.clear();
  }

  // -------------------------------------------------------------------------
  // PRIVATE METHODS
  // -------------------------------------------------------------------------

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `FL_${timestamp}_${random}`;
  }

  private triggerAlerts(failure: FailureEvent): void {
    for (const handler of this.alertHandlers) {
      try {
        handler(failure);
      } catch (error) {
        console.error('[MASTER_FAILURE_HUB] Alert handler error:', error);
      }
    }
  }

  private shouldAutoRepair(failure: FailureEvent): boolean {
    if (!this.autoRepairConfig.enabled) return false;
    if (!this.autoRepairConfig.triggerOn.includes(failure.severity)) return false;

    // Check cooldown
    const cooldownKey = `${failure.sourceHub}:${failure.subHub || ''}:${failure.failureType}`;
    const lastAttempt = this.cooldowns.get(cooldownKey);
    if (lastAttempt) {
      const cooldownMs = this.autoRepairConfig.cooldownSeconds * 1000;
      if (Date.now() - lastAttempt < cooldownMs) {
        console.log(`[MASTER_FAILURE_HUB] Auto-repair on cooldown for: ${cooldownKey}`);
        return false;
      }
    }

    return this.autoRepairHandlers.has(failure.failureType);
  }

  private async attemptAutoRepair(failure: FailureEvent): Promise<void> {
    const handler = this.autoRepairHandlers.get(failure.failureType);
    if (!handler) return;

    const cooldownKey = `${failure.sourceHub}:${failure.subHub || ''}:${failure.failureType}`;
    this.cooldowns.set(cooldownKey, Date.now());

    failure.autoRepairTriggered = true;
    console.log(`[MASTER_FAILURE_HUB] Attempting auto-repair for: ${failure.failureType}`);

    try {
      const success = await this.executeWithRetry(() => handler(failure));
      if (success) {
        failure.resolutionStatus = 'auto_repaired';
        console.log(`[MASTER_FAILURE_HUB] Auto-repair successful for: ${failure.failureType}`);
      } else {
        console.log(`[MASTER_FAILURE_HUB] Auto-repair failed for: ${failure.failureType}`);
      }
    } catch (error) {
      console.error(`[MASTER_FAILURE_HUB] Auto-repair error for ${failure.failureType}:`, error);
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.retryPolicy.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retryPolicy.maxRetries) {
          console.log(`[MASTER_FAILURE_HUB] Retry attempt ${attempt + 1} after ${delay}ms`);
          await this.sleep(delay);
          delay *= this.retryPolicy.backoffMultiplier;
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const MasterFailureHub = new MasterFailureHubClass();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Report a failure from Pass-1 hub.
 */
export function reportPass1Failure(
  spoke: string,
  failureType: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<FailureEvent> {
  return MasterFailureHub.report({
    sourceHub: 'PASS1_RECON_HUB',
    subHub: spoke,
    failureType,
    severity,
    message,
    context,
  });
}

/**
 * Report a failure from Pass-2 hub.
 */
export function reportPass2Failure(
  spoke: string,
  failureType: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<FailureEvent> {
  return MasterFailureHub.report({
    sourceHub: 'PASS2_UNDERWRITING_HUB',
    subHub: spoke,
    failureType,
    severity,
    message,
    context,
  });
}

/**
 * Report a data layer failure.
 */
export function reportDataLayerFailure(
  component: string,
  failureType: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<FailureEvent> {
  return MasterFailureHub.report({
    sourceHub: 'DATA_LAYER_HUB',
    subHub: component,
    failureType,
    severity,
    message,
    context,
  });
}

/**
 * Create a standardized failure report from an error.
 */
export function createFailureFromError(
  sourceHub: string,
  subHub: string | undefined,
  error: Error | unknown,
  severity: SeverityLevel = 'error'
): FailureReport {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    sourceHub,
    subHub,
    failureType: err.name || 'UNKNOWN_ERROR',
    severity,
    message: err.message,
    stackTrace: err.stack,
    context: {
      errorName: err.name,
      timestamp: new Date().toISOString(),
    },
  };
}

// Export types
export type { AutoRepairHandler };
