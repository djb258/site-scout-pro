/**
 * LOVABLE ADAPTER (SUPABASE COMPATIBILITY LAYER)
 * Doctrine ID: SS.DL.01
 *
 * ============================================================================
 * ALLOWED USAGE (DOCTRINE-LOCKED)
 * ============================================================================
 *
 * This adapter provides database abstraction for Lovable.dev's @lovable/cloud-db
 * which maps to Supabase as the underlying storage.
 *
 * ALLOWED CALLERS:
 * - Pass 0 Radar Hub (read/write to scratchpad tables ONLY)
 * - Pass 1 Structure Hub (read/write)
 * - Pass 1.5 Rent Recon Hub (read/write)
 * - Pass 2 Underwriting Hub (read/write)
 * - Pass 3 Design Hub (read/write)
 * - UI components (read-only queries)
 *
 * TABLES MANAGED:
 * - pass1_runs, pass1_results (scratchpad)
 * - pass2_runs, pass2_results (scratchpad)
 * - staging_payload (intermediate storage)
 * - engine_logs (audit trail)
 * - rate_observations (Pass 1.5 rate data)
 *
 * THIS ADAPTER DOES NOT:
 * - Write to Neon vault (use NeonAdapter via save_to_vault edge function)
 * - Handle Firebase (Firebase is NOT used in this repository)
 *
 * CLOUDFLARE WORKER CONSTRAINTS:
 * - No dynamic imports
 * - No Node.js APIs
 * - All returns must be JSON-serializable
 * - No filesystem access
 * ============================================================================
 */

import { getSupabase } from '../ConnectionFactory';
import type { SupabaseClient } from '@supabase/supabase-js';

// Type definitions for @lovable/cloud-db compatible interface
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

// ============================================================================
// REAL SUPABASE IMPLEMENTATION
// ============================================================================

/**
 * Create a real Supabase-backed database implementation.
 * This replaces the mock implementation with actual Supabase SDK calls.
 */
const createSupabaseDB = (): LovableDB => {
  // JSON storage table for staging data
  const JSON_STORAGE_TABLE = 'json_storage';

  return {
    /**
     * Insert a new record into a table.
     * Returns the inserted record with its generated ID.
     */
    async insert<T>(table: string, data: T): Promise<{ id: string; data: T }> {
      const supabase = getSupabase();

      // Add timestamp if not present
      const dataWithTimestamp = {
        ...data,
        created_at: (data as any).created_at || new Date().toISOString(),
      };

      const { data: result, error } = await supabase
        .from(table)
        .insert(dataWithTimestamp)
        .select()
        .single();

      if (error) {
        console.error(`[LOVABLE_DB] INSERT ${table} failed:`, error.message);
        throw new Error(`Insert failed: ${error.message}`);
      }

      console.log(`[LOVABLE_DB] INSERT ${table}:`, result.id);
      return { id: result.id, data: result as T };
    },

    /**
     * Update an existing record by ID.
     * Returns the updated record.
     */
    async update<T>(table: string, id: string, data: Partial<T>): Promise<{ id: string; data: T }> {
      const supabase = getSupabase();

      // Add updated_at timestamp
      const dataWithTimestamp = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: result, error } = await supabase
        .from(table)
        .update(dataWithTimestamp)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`[LOVABLE_DB] UPDATE ${table} failed:`, error.message);
        throw new Error(`Update failed: ${error.message}`);
      }

      console.log(`[LOVABLE_DB] UPDATE ${table}:`, id);
      return { id, data: result as T };
    },

    /**
     * Get a single record by ID.
     * Returns null if not found.
     */
    async get<T>(table: string, id: string): Promise<T | null> {
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(`[LOVABLE_DB] GET ${table} failed:`, error.message);
        throw new Error(`Get failed: ${error.message}`);
      }

      console.log(`[LOVABLE_DB] GET ${table}:`, id, result ? 'found' : 'not found');
      return result as T | null;
    },

    /**
     * Query records with optional filters.
     * Returns an array of matching records.
     */
    async query<T>(table: string, filter?: Record<string, unknown>): Promise<T[]> {
      const supabase = getSupabase();

      let query = supabase.from(table).select('*');

      // Apply filters if provided
      if (filter) {
        for (const [key, value] of Object.entries(filter)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }

      const { data: results, error } = await query;

      if (error) {
        console.error(`[LOVABLE_DB] QUERY ${table} failed:`, error.message);
        throw new Error(`Query failed: ${error.message}`);
      }

      console.log(`[LOVABLE_DB] QUERY ${table}:`, results?.length ?? 0, 'records');
      return (results ?? []) as T[];
    },

    /**
     * Delete a record by ID.
     * Returns true if deleted, false if not found.
     */
    async delete(table: string, id: string): Promise<boolean> {
      const supabase = getSupabase();

      const { error, count } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[LOVABLE_DB] DELETE ${table} failed:`, error.message);
        throw new Error(`Delete failed: ${error.message}`);
      }

      const deleted = (count ?? 0) > 0;
      console.log(`[LOVABLE_DB] DELETE ${table}:`, id, deleted ? 'success' : 'not found');
      return deleted;
    },

    /**
     * JSON key-value storage for staging data.
     * Uses a dedicated json_storage table with key-value pairs.
     */
    json(key: string) {
      return {
        async get<T>(): Promise<T | null> {
          const supabase = getSupabase();

          const { data: result, error } = await supabase
            .from(JSON_STORAGE_TABLE)
            .select('value')
            .eq('key', key)
            .maybeSingle();

          if (error) {
            // Table might not exist yet - return null silently
            if (error.code === '42P01') {
              console.log(`[LOVABLE_DB] JSON GET: table not found, returning null`);
              return null;
            }
            console.error(`[LOVABLE_DB] JSON GET ${key} failed:`, error.message);
            return null;
          }

          console.log(`[LOVABLE_DB] JSON GET:`, key, result ? 'found' : 'not found');
          return result?.value as T | null;
        },

        async set<T>(value: T): Promise<void> {
          const supabase = getSupabase();

          // Upsert the JSON value
          const { error } = await supabase
            .from(JSON_STORAGE_TABLE)
            .upsert(
              {
                key,
                value,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'key' }
            );

          if (error) {
            console.error(`[LOVABLE_DB] JSON SET ${key} failed:`, error.message);
            throw new Error(`JSON set failed: ${error.message}`);
          }

          console.log(`[LOVABLE_DB] JSON SET:`, key);
        },
      };
    },
  };
};

// ============================================================================
// FALLBACK MOCK IMPLEMENTATION (for environments without Supabase)
// ============================================================================

const createMockDB = (): LovableDB => {
  const storage = new Map<string, Map<string, unknown>>();
  const jsonStorage = new Map<string, unknown>();

  return {
    async insert<T>(table: string, data: T): Promise<{ id: string; data: T }> {
      if (!storage.has(table)) {
        storage.set(table, new Map());
      }
      const id = crypto.randomUUID();
      const record = { ...data, id, created_at: new Date().toISOString() };
      storage.get(table)!.set(id, record);
      console.log(`[LOVABLE_DB_MOCK] INSERT ${table}:`, id);
      return { id, data: record as T };
    },

    async update<T>(table: string, id: string, data: Partial<T>): Promise<{ id: string; data: T }> {
      if (!storage.has(table)) {
        storage.set(table, new Map());
      }
      const existing = storage.get(table)!.get(id);
      const existingObj = typeof existing === 'object' && existing !== null ? existing : {};
      const updated = { ...existingObj, ...data, updated_at: new Date().toISOString() };
      storage.get(table)!.set(id, updated);
      console.log(`[LOVABLE_DB_MOCK] UPDATE ${table}:`, id);
      return { id, data: updated as T };
    },

    async get<T>(table: string, id: string): Promise<T | null> {
      if (!storage.has(table)) return null;
      const record = storage.get(table)!.get(id);
      console.log(`[LOVABLE_DB_MOCK] GET ${table}:`, id, record ? 'found' : 'not found');
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
      console.log(`[LOVABLE_DB_MOCK] DELETE ${table}:`, id, result ? 'success' : 'not found');
      return result;
    },

    json(key: string) {
      return {
        async get<T>(): Promise<T | null> {
          return (jsonStorage.get(key) as T) || null;
        },
        async set<T>(value: T): Promise<void> {
          jsonStorage.set(key, value);
          console.log(`[LOVABLE_DB_MOCK] JSON SET:`, key);
        },
      };
    },
  };
};

// ============================================================================
// DATABASE INSTANCE SELECTION
// ============================================================================

/**
 * Determine which database implementation to use.
 * Uses real Supabase if credentials are available, otherwise falls back to mock.
 */
function selectDatabase(): LovableDB {
  // Check if Supabase credentials are available
  const hasSupabaseCredentials = !!(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  );

  if (hasSupabaseCredentials) {
    console.log('[LOVABLE_ADAPTER] Using real Supabase database');
    return createSupabaseDB();
  }

  console.warn('[LOVABLE_ADAPTER] No Supabase credentials found, using mock database');
  return createMockDB();
}

// Export the selected database implementation
export const db: LovableDB = selectDatabase();

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
