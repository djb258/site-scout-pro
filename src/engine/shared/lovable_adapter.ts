/**
 * LOVABLE COMPATIBILITY LAYER
 *
 * Provides database abstraction for Lovable.dev's @lovable/cloud-db
 * All orchestrators and edge functions should use these helpers
 * instead of direct database calls.
 *
 * IMPORTANT: This adapter handles the Cloudflare Worker limitations:
 * - No dynamic imports
 * - No Node.js APIs
 * - All returns must be JSON-serializable
 * - No filesystem access
 */

// Type definitions for @lovable/cloud-db
// In production, import from "@lovable/cloud-db"
interface LovableDB {
  insert<T>(table: string, data: T): Promise<{ id: string; data: T }>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<{ id: string; data: T }>;
  get<T>(table: string, id: string): Promise<T | null>;
  query<T>(table: string, filter?: Record<string, unknown>): Promise<T[]>;
  delete(table: string, id: string): Promise<boolean>;
  json(key: string): {
    get<T>(): Promise<T | null>;
    set<T>(value: T): Promise<void>;
  };
}

// Mock implementation for development
// Replace with actual @lovable/cloud-db import in production
const createMockDB = (): LovableDB => {
  const storage = new Map<string, Map<string, unknown>>();
  const jsonStorage = new Map<string, unknown>();

  return {
    async insert<T>(table: string, data: T): Promise<{ id: string; data: T }> {
      if (!storage.has(table)) {
        storage.set(table, new Map());
      }
      const id = crypto.randomUUID();
      const record = { ...data, id, created_at: Date.now() };
      storage.get(table)!.set(id, record);
      console.log(`[LOVABLE_DB] INSERT ${table}:`, id);
      return { id, data: record as T };
    },

    async update<T>(table: string, id: string, data: Partial<T>): Promise<{ id: string; data: T }> {
      if (!storage.has(table)) {
        storage.set(table, new Map());
      }
      const existing = storage.get(table)!.get(id);
      const existingObj = typeof existing === 'object' && existing !== null ? existing : {};
      const updated = { ...existingObj, ...data, updated_at: Date.now() };
      storage.get(table)!.set(id, updated);
      console.log(`[LOVABLE_DB] UPDATE ${table}:`, id);
      return { id, data: updated as T };
    },

    async get<T>(table: string, id: string): Promise<T | null> {
      if (!storage.has(table)) return null;
      const record = storage.get(table)!.get(id);
      console.log(`[LOVABLE_DB] GET ${table}:`, id, record ? 'found' : 'not found');
      return (record as T) || null;
    },

    async query<T>(table: string, filter?: Record<string, unknown>): Promise<T[]> {
      if (!storage.has(table)) return [];
      const records = Array.from(storage.get(table)!.values());
      if (!filter) return records as T[];

      return records.filter((record) => {
        return Object.entries(filter).every(([key, value]) => {
          return (record as Record<string, unknown>)[key] === value;
        });
      }) as T[];
    },

    async delete(table: string, id: string): Promise<boolean> {
      if (!storage.has(table)) return false;
      const result = storage.get(table)!.delete(id);
      console.log(`[LOVABLE_DB] DELETE ${table}:`, id, result ? 'success' : 'not found');
      return result;
    },

    json(key: string) {
      return {
        async get<T>(): Promise<T | null> {
          return (jsonStorage.get(key) as T) || null;
        },
        async set<T>(value: T): Promise<void> {
          jsonStorage.set(key, value);
          console.log(`[LOVABLE_DB] JSON SET:`, key);
        },
      };
    },
  };
};

// In production, replace with:
// import { db } from "@lovable/cloud-db";
export const db: LovableDB = createMockDB();

// ============================================================================
// DATABASE TABLE NAMES
// ============================================================================

export const TABLES = {
  // Pass 1 scratch tables
  PASS1_RUNS: 'pass1_runs',
  PASS1_RESULTS: 'pass1_results',

  // Local scan scratch tables
  LOCAL_SCAN_RUNS: 'local_scan_runs',
  LOCAL_SCAN_RESULTS: 'local_scan_results',

  // AI Caller scratch tables
  CALL_BATCHES: 'call_batches',
  CALL_RESULTS: 'call_results',
  RATE_OBSERVATIONS: 'rate_observations',

  // Pass 2 scratch tables
  PASS2_RUNS: 'pass2_runs',
  PASS2_RESULTS: 'pass2_results',
  STAGING_PAYLOAD: 'staging_payload',

  // Permanent storage (Neon via save_to_vault only)
  VAULT: 'opportunities_vault',

  // Logging
  ENGINE_LOGS: 'engine_logs',
} as const;

// ============================================================================
// RUN MANAGEMENT HELPERS
// ============================================================================

export interface RunRecord {
  id: string;
  zip_code: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  created_at: number;
  updated_at?: number;
  error?: string;
}

/**
 * Create a new run record
 */
export async function createRun(
  table: string,
  zipCode: string,
  metadata?: Record<string, unknown>
): Promise<{ id: string }> {
  const result = await db.insert(table, {
    zip_code: zipCode,
    status: 'pending',
    ...metadata,
  });

  await writeLog('run_created', {
    table,
    run_id: result.id,
    zip_code: zipCode,
  });

  return { id: result.id };
}

/**
 * Update run status
 */
export async function updateRunStatus(
  table: string,
  runId: string,
  status: RunRecord['status'],
  data?: Record<string, unknown>
): Promise<void> {
  await db.update(table, runId, {
    status,
    ...data,
  });

  await writeLog('run_status_updated', {
    table,
    run_id: runId,
    status,
  });
}

/**
 * Get run by ID
 */
export async function getRun<T extends RunRecord>(
  table: string,
  runId: string
): Promise<T | null> {
  return db.get<T>(table, runId);
}

// ============================================================================
// DATA PERSISTENCE HELPERS
// ============================================================================

/**
 * Write data to scratchpad table
 */
export async function writeData<T>(
  table: string,
  data: T
): Promise<{ id: string; data: T }> {
  const result = await db.insert(table, data);

  await writeLog('data_written', {
    table,
    record_id: result.id,
  });

  return result;
}

/**
 * Update data in scratchpad table
 */
export async function updateData<T>(
  table: string,
  id: string,
  data: Partial<T>
): Promise<{ id: string; data: T }> {
  const result = await db.update(table, id, data);

  await writeLog('data_updated', {
    table,
    record_id: id,
  });

  return result;
}

/**
 * Read data from scratchpad table
 */
export async function readData<T>(
  table: string,
  id: string
): Promise<T | null> {
  return db.get<T>(table, id);
}

/**
 * Query data from scratchpad table
 */
export async function queryData<T>(
  table: string,
  filter?: Record<string, unknown>
): Promise<T[]> {
  return db.query<T>(table, filter);
}

// ============================================================================
// JSON STAGING HELPERS
// ============================================================================

/**
 * Stage opportunity object as JSON
 */
export async function stageOpportunity(
  runId: string,
  opportunity: unknown
): Promise<void> {
  await db.json(`opportunity_${runId}`).set(opportunity);

  await writeLog('opportunity_staged', {
    run_id: runId,
  });
}

/**
 * Get staged opportunity object
 */
export async function getStagedOpportunity<T>(runId: string): Promise<T | null> {
  return db.json(`opportunity_${runId}`).get<T>();
}

/**
 * Stage intermediate results
 */
export async function stageResults(
  runId: string,
  resultType: string,
  results: unknown
): Promise<void> {
  await db.json(`${resultType}_${runId}`).set(results);

  await writeLog('results_staged', {
    run_id: runId,
    result_type: resultType,
  });
}

/**
 * Get staged results
 */
export async function getStagedResults<T>(
  runId: string,
  resultType: string
): Promise<T | null> {
  return db.json(`${resultType}_${runId}`).get<T>();
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

/**
 * Write engine log entry
 */
export async function writeLog(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(TABLES.ENGINE_LOGS, {
      event,
      payload,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Don't let logging failures break the main flow
    console.error('[LOVABLE_ADAPTER] Log write failed:', error);
  }
}

/**
 * Write error log entry
 */
export async function writeErrorLog(
  event: string,
  error: Error | string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(TABLES.ENGINE_LOGS, {
      event: `error_${event}`,
      payload: {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      },
      timestamp: Date.now(),
    });
  } catch (logError) {
    console.error('[LOVABLE_ADAPTER] Error log write failed:', logError);
  }
}

// ============================================================================
// JSON SERIALIZATION HELPERS
// ============================================================================

/**
 * Ensure data is JSON-serializable (Cloudflare Worker requirement)
 */
export function ensureSerializable<T>(data: T): T {
  // Deep clone to remove any non-serializable properties
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.error('[LOVABLE_ADAPTER] Serialization failed:', error);
    throw new Error('Data contains non-serializable values');
  }
}

/**
 * Create a safe response object for edge functions
 */
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string
): { success: boolean; data?: T; error?: string; timestamp: number } {
  const response = {
    success,
    data: data ? ensureSerializable(data) : undefined,
    error,
    timestamp: Date.now(),
  };

  return response;
}

// ============================================================================
// VAULT HELPERS (Only place that writes to permanent Neon storage)
// ============================================================================

/**
 * Save to permanent vault storage
 * This is the ONLY function that should write to Neon
 */
export async function saveToVault(
  vaultPayload: unknown
): Promise<{ vault_id: string }> {
  // In production, this would write to Neon via save_to_vault edge function
  const result = await db.insert(TABLES.VAULT, ensureSerializable(vaultPayload));

  await writeLog('vault_saved', {
    vault_id: result.id,
  });

  return { vault_id: result.id };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { LovableDB };
