/**
 * MASTER FAILURE LOGGER
 *
 * Database persistence layer for the centralized failure tracking system.
 * Writes failures to the master_failure_log table in Neon PostgreSQL.
 *
 * ADR: ADR-013-master-failure-log.md
 * Doctrine ID: SS.00.FL
 *
 * ============================================================================
 * PERSISTENCE SCOPE & SINK BEHAVIOR
 * ============================================================================
 *
 * This logger supports DUAL SINKS:
 *   1. CONSOLE (always active) - Immediate visibility for all passes
 *   2. SUPABASE (environment-controlled) - Persistent database storage
 *
 * SINK ACTIVATION BY PASS:
 * ┌──────────┬─────────────┬──────────────────────────────────────────────────┐
 * │ Pass     │ Console     │ Supabase Database                                │
 * ├──────────┼─────────────┼──────────────────────────────────────────────────┤
 * │ Pass 0   │ ALWAYS ON   │ OFF (no credentials in edge environment)         │
 * │ Pass 1   │ ALWAYS ON   │ ON (when SUPABASE_URL configured)                │
 * │ Pass 1.5 │ ALWAYS ON   │ ON (when SUPABASE_URL configured)                │
 * │ Pass 2   │ ALWAYS ON   │ ON (when SUPABASE_URL configured)                │
 * │ Pass 3   │ ALWAYS ON   │ ON (when SUPABASE_URL configured)                │
 * └──────────┴─────────────┴──────────────────────────────────────────────────┘
 *
 * ENVIRONMENT-BASED KILL SWITCH:
 *   - If SUPABASE_URL or SUPABASE_ANON_KEY are missing/empty:
 *     → Database sink is DISABLED (silent degradation)
 *     → Console sink remains ACTIVE
 *     → Warning logged: "[MASTER_FAILURE_LOGGER] Supabase credentials not configured"
 *
 *   - Default behavior in Pass 0 (Lovable.dev edge):
 *     → Supabase credentials are NOT available by design
 *     → Pass 0 failures are logged to CONSOLE ONLY
 *     → This is intentional and correct behavior
 *
 *   - Default behavior in Pass 1-3 (server/orchestrator context):
 *     → Supabase credentials SHOULD be configured
 *     → Failures are logged to BOTH console AND database
 *     → Missing credentials in Pass 1-3 indicates misconfiguration
 *
 * NEON DATABASE NOTE:
 *   This logger writes to SUPABASE (scratchpad), NOT directly to Neon.
 *   Neon (vault) persistence is handled separately by VaultMapper in Pass 2.
 *   The master_failure_log table exists in Supabase for real-time monitoring.
 *
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PassIdentifier = 'PASS0' | 'PASS1' | 'PASS1_5' | 'PASS2' | 'PASS3' | 'DATA_LAYER' | 'SYSTEM';
export type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';
export type ResolutionStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_repaired';

export interface MasterFailureLogEntry {
  id?: string;
  process_id: string;
  opportunity_id?: string;
  pass: PassIdentifier;
  spoke?: string;
  orchestrator_run_id?: string;
  error_code: string;
  error_category?: string;
  severity: SeverityLevel;
  message: string;
  stack_trace?: string;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  resolution_status?: ResolutionStatus;
  auto_repair_attempted?: boolean;
  auto_repair_succeeded?: boolean;
  retry_count?: number;
}

export interface FailureQueryOptions {
  pass?: PassIdentifier;
  spoke?: string;
  severity?: SeverityLevel | SeverityLevel[];
  status?: ResolutionStatus | ResolutionStatus[];
  opportunityId?: string;
  processId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// SUPABASE CLIENT (Lazy Initialization)
// ============================================================================

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[MASTER_FAILURE_LOGGER] Supabase credentials not configured - logging to console only');
      // Return a mock client that just logs
      return {
        from: () => ({
          insert: async (data: unknown) => {
            console.log('[MASTER_FAILURE_LOGGER] (No DB)', JSON.stringify(data, null, 2));
            return { data: null, error: null };
          },
          select: async () => ({ data: [], error: null }),
          update: async () => ({ data: null, error: null }),
        }),
      } as unknown as SupabaseClient;
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
}

// ============================================================================
// CORE LOGGING FUNCTION
// ============================================================================

/**
 * Log a failure to the master_failure_log table
 */
export async function logFailure(entry: MasterFailureLogEntry): Promise<string | null> {
  const client = getSupabaseClient();

  // Console log for immediate visibility
  const logPrefix = `[${entry.pass}${entry.spoke ? '/' + entry.spoke : ''}]`;
  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  }[entry.severity];

  console.log(
    `${severityEmoji} ${logPrefix} ${entry.error_code}: ${entry.message}`
  );

  // Write to database
  try {
    const { data, error } = await client
      .from('master_failure_log')
      .insert({
        process_id: entry.process_id,
        opportunity_id: entry.opportunity_id,
        pass: entry.pass,
        spoke: entry.spoke,
        orchestrator_run_id: entry.orchestrator_run_id,
        error_code: entry.error_code,
        error_category: entry.error_category,
        severity: entry.severity,
        message: entry.message,
        stack_trace: entry.stack_trace,
        input_payload: entry.input_payload,
        output_payload: entry.output_payload,
        context: entry.context,
        resolution_status: entry.resolution_status || 'open',
        auto_repair_attempted: entry.auto_repair_attempted || false,
        auto_repair_succeeded: entry.auto_repair_succeeded,
        retry_count: entry.retry_count || 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[MASTER_FAILURE_LOGGER] Database write failed:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[MASTER_FAILURE_LOGGER] Exception during logging:', err);
    return null;
  }
}

// ============================================================================
// PASS-SPECIFIC CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Log a Pass-0 (Radar Hub) failure
 *
 * IMPORTANT: Pass 0 runs in Lovable.dev edge environment where Supabase
 * credentials are NOT available. This function will log to CONSOLE ONLY.
 * This is correct and expected behavior - Pass 0 failures are visible
 * in edge function logs but not persisted to database.
 */
export async function logPass0Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'PASS0',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

/**
 * Log a Pass-1 (Structure Hub) failure
 */
export async function logPass1Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'PASS1',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

/**
 * Log a Pass-1.5 (Rent Recon Hub) failure
 */
export async function logPass15Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'PASS1_5',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

/**
 * Log a Pass-2 (Underwriting Hub) failure
 */
export async function logPass2Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'PASS2',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

/**
 * Log a Pass-3 (Design/Calculator Hub) failure
 */
export async function logPass3Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'PASS3',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

/**
 * Log a Data Layer failure
 */
export async function logDataLayerFailure(
  processId: string,
  component: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'DATA_LAYER',
    spoke: component,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

/**
 * Log a System-level failure
 */
export async function logSystemFailure(
  processId: string,
  component: string,
  errorCode: string,
  severity: SeverityLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  return logFailure({
    process_id: processId,
    pass: 'SYSTEM',
    spoke: component,
    error_code: errorCode,
    severity,
    message,
    context,
  });
}

// ============================================================================
// ERROR CONVERSION HELPERS
// ============================================================================

/**
 * Create a failure entry from a caught error
 */
export function createFailureFromError(
  pass: PassIdentifier,
  spoke: string,
  processId: string,
  error: Error | unknown,
  severity: SeverityLevel = 'error'
): MasterFailureLogEntry {
  const err = error instanceof Error ? error : new Error(String(error));

  return {
    process_id: processId,
    pass,
    spoke,
    error_code: err.name || 'UNKNOWN_ERROR',
    severity,
    message: err.message,
    stack_trace: err.stack,
    context: {
      errorName: err.name,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Log an error caught in a try/catch block
 */
export async function logCaughtError(
  pass: PassIdentifier,
  spoke: string,
  processId: string,
  error: Error | unknown,
  severity: SeverityLevel = 'error',
  additionalContext?: Record<string, unknown>
): Promise<string | null> {
  const entry = createFailureFromError(pass, spoke, processId, error, severity);

  if (additionalContext) {
    entry.context = { ...entry.context, ...additionalContext };
  }

  return logFailure(entry);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Query failures from the master_failure_log
 */
export async function queryFailures(options: FailureQueryOptions): Promise<MasterFailureLogEntry[]> {
  const client = getSupabaseClient();

  let query = client.from('master_failure_log').select('*');

  if (options.pass) {
    query = query.eq('pass', options.pass);
  }

  if (options.spoke) {
    query = query.eq('spoke', options.spoke);
  }

  if (options.severity) {
    if (Array.isArray(options.severity)) {
      query = query.in('severity', options.severity);
    } else {
      query = query.eq('severity', options.severity);
    }
  }

  if (options.status) {
    if (Array.isArray(options.status)) {
      query = query.in('resolution_status', options.status);
    } else {
      query = query.eq('resolution_status', options.status);
    }
  }

  if (options.opportunityId) {
    query = query.eq('opportunity_id', options.opportunityId);
  }

  if (options.processId) {
    query = query.eq('process_id', options.processId);
  }

  if (options.fromTimestamp) {
    query = query.gte('created_at', options.fromTimestamp);
  }

  if (options.toTimestamp) {
    query = query.lte('created_at', options.toTimestamp);
  }

  query = query.order('created_at', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[MASTER_FAILURE_LOGGER] Query failed:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Update the resolution status of a failure
 */
export async function updateFailureStatus(
  failureId: string,
  status: ResolutionStatus,
  resolvedBy?: string,
  notes?: string
): Promise<boolean> {
  const client = getSupabaseClient();

  const updates: Record<string, unknown> = {
    resolution_status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'resolved' || status === 'auto_repaired') {
    updates.resolved_at = new Date().toISOString();
  }

  if (resolvedBy) {
    updates.resolved_by = resolvedBy;
  }

  if (notes) {
    updates.resolution_notes = notes;
  }

  const { error } = await client
    .from('master_failure_log')
    .update(updates)
    .eq('id', failureId);

  if (error) {
    console.error('[MASTER_FAILURE_LOGGER] Status update failed:', error.message);
    return false;
  }

  return true;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a new process ID for tracking a pipeline run
 */
export function generateProcessId(): string {
  return crypto.randomUUID();
}

/**
 * Get failure statistics for a time period
 */
export async function getFailureStats(
  fromTimestamp?: string,
  toTimestamp?: string
): Promise<{
  total: number;
  bySeverity: Record<SeverityLevel, number>;
  byPass: Record<PassIdentifier, number>;
  byStatus: Record<ResolutionStatus, number>;
}> {
  const failures = await queryFailures({
    fromTimestamp,
    toTimestamp,
    limit: 10000,
  });

  const stats = {
    total: failures.length,
    bySeverity: { info: 0, warning: 0, error: 0, critical: 0 } as Record<SeverityLevel, number>,
    byPass: { PASS0: 0, PASS1: 0, PASS1_5: 0, PASS2: 0, PASS3: 0, DATA_LAYER: 0, SYSTEM: 0 } as Record<PassIdentifier, number>,
    byStatus: { open: 0, acknowledged: 0, in_progress: 0, resolved: 0, auto_repaired: 0 } as Record<ResolutionStatus, number>,
  };

  for (const failure of failures) {
    stats.bySeverity[failure.severity]++;
    stats.byPass[failure.pass]++;
    if (failure.resolution_status) {
      stats.byStatus[failure.resolution_status]++;
    }
  }

  return stats;
}
