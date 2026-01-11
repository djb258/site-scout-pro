/**
 * CONNECTION FACTORY — Centralized Database Connection Management
 * ============================================================================
 *
 * This module provides centralized access to database connections for the
 * Storage Container Go/No-Go pipeline.
 *
 * HYBRID DATABASE APPROACH:
 * - Supabase: Pass 0-1 scratchpad/working storage, reference data reads
 * - Neon: CCA, Pass 2 jurisdiction cards, vault (permanent storage)
 *
 * ============================================================================
 * USAGE BY PASS
 * ============================================================================
 *
 * Pass 0 (Radar Hub):
 *   - Supabase ONLY (read reference data, write scratchpad)
 *   - CANNOT use Neon (edge function constraint)
 *
 * Pass 1 (Structure Hub):
 *   - Supabase for reference data and scratchpad
 *   - Optional: Neon for CCA reads
 *
 * Pass 1.5 (Rent Recon Hub):
 *   - Supabase for rate observations
 *
 * Pass 2 (Underwriting Hub):
 *   - Neon for jurisdiction cards (read/write)
 *   - Neon for CCA reads
 *   - Supabase for scratchpad
 *
 * Pass 3 (Design Hub):
 *   - Neon for Pass 2 view reads
 *   - Supabase for results
 *
 * CCA Service:
 *   - Neon ONLY for ref.county_capability
 *
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, neon, NeonQueryFunction } from '@neondatabase/serverless';

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionConfig {
  supabase?: {
    url: string;
    anonKey?: string;
    serviceRoleKey?: string;
  };
  neon?: {
    connectionString: string;
    pooled?: boolean;
  };
}

export interface HealthCheckResult {
  supabase: {
    connected: boolean;
    latencyMs: number | null;
    error?: string;
  };
  neon: {
    connected: boolean;
    latencyMs: number | null;
    error?: string;
  };
}

// ============================================================================
// CONNECTION FACTORY SINGLETON
// ============================================================================

class ConnectionFactoryImpl {
  private supabaseClient: SupabaseClient | null = null;
  private neonPool: Pool | null = null;
  private neonSql: NeonQueryFunction<false, any[]> | null = null;
  private config: ConnectionConfig | null = null;
  private initialized = false;

  /**
   * Initialize the connection factory with configuration.
   * Call this once at application startup.
   */
  initialize(config?: Partial<ConnectionConfig>): void {
    // Build config from environment variables with optional overrides
    this.config = {
      supabase: {
        url: config?.supabase?.url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        anonKey: config?.supabase?.anonKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
        serviceRoleKey: config?.supabase?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
      neon: {
        connectionString: config?.neon?.connectionString || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '',
        pooled: config?.neon?.pooled ?? true,
      },
    };

    this.initialized = true;
    console.log('[ConnectionFactory] Initialized');
  }

  /**
   * Get Supabase client for Pass 0-1 and reference data access.
   * Uses service role key if available, otherwise anon key.
   */
  getSupabase(): SupabaseClient {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.supabaseClient) {
      return this.supabaseClient;
    }

    const url = this.config?.supabase?.url;
    const key = this.config?.supabase?.serviceRoleKey || this.config?.supabase?.anonKey;

    if (!url || !key) {
      throw new Error(
        '[ConnectionFactory] Supabase URL or key not configured. ' +
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables.'
      );
    }

    this.supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[ConnectionFactory] Supabase client created');
    return this.supabaseClient;
  }

  /**
   * Get Neon connection pool for CCA, Pass 2, and vault access.
   * Uses connection pooling for better performance.
   */
  getNeonPool(): Pool {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.neonPool) {
      return this.neonPool;
    }

    const connectionString = this.config?.neon?.connectionString;

    if (!connectionString) {
      throw new Error(
        '[ConnectionFactory] Neon connection string not configured. ' +
        'Set NEON_DATABASE_URL or DATABASE_URL environment variable.'
      );
    }

    this.neonPool = new Pool({ connectionString });
    console.log('[ConnectionFactory] Neon pool created');
    return this.neonPool;
  }

  /**
   * Get Neon SQL template tag for simple queries.
   * Useful for edge functions and single queries.
   */
  getNeonSql(): NeonQueryFunction<false, any[]> {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.neonSql) {
      return this.neonSql;
    }

    const connectionString = this.config?.neon?.connectionString;

    if (!connectionString) {
      throw new Error(
        '[ConnectionFactory] Neon connection string not configured. ' +
        'Set NEON_DATABASE_URL or DATABASE_URL environment variable.'
      );
    }

    this.neonSql = neon(connectionString);
    console.log('[ConnectionFactory] Neon SQL function created');
    return this.neonSql;
  }

  /**
   * Execute a raw SQL query against Neon.
   * Convenience method that handles pool acquisition.
   */
  async executeNeonQuery<T = any>(
    sql: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const pool = this.getNeonPool();
    const result = await pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  /**
   * Check health of all database connections.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      supabase: { connected: false, latencyMs: null },
      neon: { connected: false, latencyMs: null },
    };

    // Check Supabase
    try {
      const startSupabase = Date.now();
      const supabase = this.getSupabase();
      // Simple query to check connectivity
      await supabase.from('engine_logs').select('id').limit(1);
      result.supabase.connected = true;
      result.supabase.latencyMs = Date.now() - startSupabase;
    } catch (error) {
      result.supabase.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Neon
    try {
      const startNeon = Date.now();
      await this.executeNeonQuery('SELECT 1');
      result.neon.connected = true;
      result.neon.latencyMs = Date.now() - startNeon;
    } catch (error) {
      result.neon.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * Close all connections. Call during application shutdown.
   */
  async close(): Promise<void> {
    if (this.neonPool) {
      await this.neonPool.end();
      this.neonPool = null;
      console.log('[ConnectionFactory] Neon pool closed');
    }

    // Supabase client doesn't need explicit closing
    this.supabaseClient = null;
    this.neonSql = null;
    this.initialized = false;

    console.log('[ConnectionFactory] All connections closed');
  }

  /**
   * Reset factory state (useful for testing).
   */
  reset(): void {
    this.supabaseClient = null;
    this.neonPool = null;
    this.neonSql = null;
    this.config = null;
    this.initialized = false;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const ConnectionFactory = new ConnectionFactoryImpl();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get Supabase client (convenience function).
 */
export function getSupabase(): SupabaseClient {
  return ConnectionFactory.getSupabase();
}

/**
 * Get Neon pool (convenience function).
 */
export function getNeonPool(): Pool {
  return ConnectionFactory.getNeonPool();
}

/**
 * Get Neon SQL template function (convenience function).
 */
export function getNeonSql(): NeonQueryFunction<false, any[]> {
  return ConnectionFactory.getNeonSql();
}

/**
 * Execute a Neon query (convenience function).
 */
export async function executeNeonQuery<T = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  return ConnectionFactory.executeNeonQuery<T>(sql, params);
}

/**
 * Check database health (convenience function).
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  return ConnectionFactory.healthCheck();
}
