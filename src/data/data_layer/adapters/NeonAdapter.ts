/**
 * NEON ADAPTER (STAMPED VAULT PERSISTENCE)
 * Doctrine ID: SS.DL.02
 *
 * ============================================================================
 * HARD CONSTRAINTS (NON-NEGOTIABLE)
 * ============================================================================
 *
 * THIS ADAPTER MAY ONLY BE USED BY:
 * - Pass 3 Design Hub orchestrator (VAULT WRITES ONLY via logXxxToVault)
 * - Vault promotion functions (promoteXxxToVault)
 * - save_to_vault edge function
 * - CCA Service (for ref.county_capability)
 *
 * FORBIDDEN CONSUMERS:
 * - Pass 0 (HARD BAN - edge function)
 * - Pass 1 (use Supabase)
 * - Pass 1.5 (use Supabase)
 * - Pass 2 (use Supabase staging)
 * - UI (read-only via API)
 *
 * ============================================================================
 * !!!! PASS 0/1/1.5/2 USAGE IS A HARD VIOLATION !!!!
 * ============================================================================
 *
 * Pass 0-2 MUST NOT:
 * - Import this adapter
 * - Import @neondatabase/serverless
 * - Reference any Neon connection strings or credentials
 * - Write to any vault tables
 * - Promote opportunities to persistent storage
 *
 * These passes operate with Supabase for staging data. Only after validation
 * can data be promoted to Neon vault via explicit promotion functions.
 * Violations will cause CI failure.
 *
 * ============================================================================
 * PURPOSE
 * ============================================================================
 *
 * This adapter handles:
 * - CCA (ref.county_capability) reads and writes
 * - Vault persistence for STAMPED underwriting records
 * - Read-only access to pass2 views for Pass 3 consumption
 *
 * SCHEMAS MANAGED:
 * - ref.county_capability (CCA)
 * - pass2.v_jurisdiction_card_for_pass3 (READ-ONLY view for Pass 3)
 * - vault.* (underwriting records)
 *
 * NOTE: Pass 2 writes go to Supabase staging tables, not directly to Neon.
 * Data is promoted to Neon only via promoteXxxToVault() functions.
 *
 * ============================================================================
 */

import { Pool, neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getNeonPool, executeNeonQuery } from '../ConnectionFactory';

// ============================================================================
// NEON CLIENT INTERFACE
// ============================================================================

export interface NeonVaultRecord {
  id: string;
  run_id: string;
  pass1_run_id: string;
  zip_code: string;
  state: string;
  verdict: 'GO' | 'NO_GO' | 'MAYBE';
  deal_index: number;
  noi: number;
  noi_per_acre_monthly: number;
  passes_doctrine: boolean;
  cap_rate: number;
  dscr: number;
  fatal_flaws: unknown[];
  feasibility_score: number;
  demand_score: number;
  competitive_score: number;
  zoning_score: number;
  stamped: boolean;
  stamp_timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface NeonQueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface NeonAdapterConfig {
  connectionString: string;
  ssl: boolean;
  poolSize?: number;
}

// ============================================================================
// CCA TYPES (County Capability Asset)
// ============================================================================

export interface CountyCapabilityRecord {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string;

  // Pass 0 dispatch
  pass0_method: 'api' | 'scrape' | 'portal' | 'manual' | null;
  pass0_coverage: 'full' | 'partial' | 'insufficient' | null;
  pass0_vendor: string | null;
  pass0_has_api: boolean | null;
  pass0_has_portal: boolean | null;
  pass0_inspections_linked: boolean | null;

  // Pass 2 dispatch
  pass2_method: 'api' | 'scrape' | 'portal' | 'manual' | null;
  pass2_coverage: 'full' | 'partial' | 'insufficient' | null;
  pass2_zoning_model_detected: 'no_zoning' | 'county' | 'municipal' | 'mixed' | null;
  pass2_ordinance_format: string | null;
  pass2_has_gis: boolean | null;
  pass2_has_online_ordinance: boolean | null;
  pass2_planning_url: string | null;
  pass2_ordinance_url: string | null;

  // TTL
  confidence: 'low' | 'medium' | 'high';
  verified_at: string;
  ttl_months: number;
  expires_at: string;
  version: number;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// JURISDICTION CARD TYPES (Pass 2)
// ============================================================================

export interface JurisdictionCardRecord {
  county_id: number;
  county_name: string;
  state: string;
  county_fips: string;
  asset_class: string;

  // From jurisdiction_scope
  authority_model: 'county' | 'municipal' | 'mixed' | 'none' | null;
  zoning_model: 'no_zoning' | 'county' | 'municipal' | 'mixed' | null;
  controlling_authority_name: string | null;

  // From use_viability
  storage_allowed: 'yes' | 'no' | 'unknown';
  fatal_prohibition: 'yes' | 'no' | 'unknown';
  conditional_use_required: 'yes' | 'no' | 'unknown';

  // From zoning_envelope
  setback_front: number | null;
  setback_side: number | null;
  setback_rear: number | null;
  max_lot_coverage: number | null;
  max_height: number | null;
  max_stories: number | null;

  // From fire_life_safety
  fire_lane_required: 'yes' | 'no' | 'unknown';
  sprinkler_required: 'yes' | 'no' | 'unknown';

  // From stormwater_environmental
  detention_required: 'yes' | 'no' | 'unknown';
  max_impervious: number | null;

  // Computed
  envelope_complete: boolean;

  last_updated: string;
}

// ============================================================================
// NEON ADAPTER CLASS
// ============================================================================

/**
 * NeonAdapter - Database operations for CCA, Pass 2, and Vault
 *
 * USAGE RESTRICTION: Pass 1-3 orchestrators, CCA Service, and save_to_vault ONLY
 * PASS 0 IS FORBIDDEN FROM USING THIS ADAPTER
 */
export class NeonAdapter {
  private pool: Pool | null = null;
  private initialized = false;

  /**
   * Initialize the Neon connection.
   * Uses ConnectionFactory if no config provided.
   */
  initialize(config?: NeonAdapterConfig): void {
    if (config?.connectionString) {
      this.pool = new Pool({ connectionString: config.connectionString });
    } else {
      // Use ConnectionFactory
      this.pool = getNeonPool();
    }
    this.initialized = true;
    console.log('[NeonAdapter] Initialized');
  }

  /**
   * Ensure adapter is initialized before operations.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * Get the connection pool.
   */
  private getPool(): Pool {
    this.ensureInitialized();
    if (!this.pool) {
      throw new Error('[NeonAdapter] Pool not available');
    }
    return this.pool;
  }

  // ===========================================================================
  // RAW QUERY EXECUTION
  // ===========================================================================

  /**
   * Execute raw SQL query.
   */
  async executeRaw<T = any>(sql: string, params?: unknown[]): Promise<NeonQueryResult<T>> {
    const pool = this.getPool();
    const result = await pool.query(sql, params as any[]);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  // ===========================================================================
  // CCA OPERATIONS (ref.county_capability)
  // ===========================================================================

  /**
   * Get CCA profile for a county.
   */
  async getCcaProfile(countyId: number): Promise<CountyCapabilityRecord | null> {
    const result = await this.executeRaw<CountyCapabilityRecord>(
      `SELECT * FROM ref.county_capability WHERE county_id = $1`,
      [countyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get CCA profile by state and county name.
   */
  async getCcaProfileByName(state: string, countyName: string): Promise<CountyCapabilityRecord | null> {
    const result = await this.executeRaw<CountyCapabilityRecord>(
      `SELECT * FROM ref.county_capability WHERE state = $1 AND county_name = $2`,
      [state, countyName]
    );
    return result.rows[0] || null;
  }

  /**
   * Upsert CCA profile.
   */
  async upsertCcaProfile(profile: Partial<CountyCapabilityRecord> & { county_id: number }): Promise<CountyCapabilityRecord> {
    const result = await this.executeRaw<CountyCapabilityRecord>(
      `INSERT INTO ref.county_capability (
        county_id, state, county_name, county_fips,
        pass0_method, pass0_coverage, pass0_vendor, pass0_has_api, pass0_has_portal, pass0_inspections_linked,
        pass2_method, pass2_coverage, pass2_zoning_model_detected, pass2_ordinance_format,
        pass2_has_gis, pass2_has_online_ordinance, pass2_planning_url, pass2_ordinance_url,
        confidence, verified_at, ttl_months
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), $20
      )
      ON CONFLICT (county_id) DO UPDATE SET
        state = EXCLUDED.state,
        county_name = EXCLUDED.county_name,
        pass0_method = COALESCE(EXCLUDED.pass0_method, ref.county_capability.pass0_method),
        pass0_coverage = COALESCE(EXCLUDED.pass0_coverage, ref.county_capability.pass0_coverage),
        pass0_vendor = COALESCE(EXCLUDED.pass0_vendor, ref.county_capability.pass0_vendor),
        pass2_method = COALESCE(EXCLUDED.pass2_method, ref.county_capability.pass2_method),
        pass2_coverage = COALESCE(EXCLUDED.pass2_coverage, ref.county_capability.pass2_coverage),
        pass2_zoning_model_detected = COALESCE(EXCLUDED.pass2_zoning_model_detected, ref.county_capability.pass2_zoning_model_detected),
        confidence = EXCLUDED.confidence,
        verified_at = NOW(),
        version = ref.county_capability.version + 1,
        updated_at = NOW()
      RETURNING *`,
      [
        profile.county_id,
        profile.state || '',
        profile.county_name || '',
        profile.county_fips || '',
        profile.pass0_method || null,
        profile.pass0_coverage || null,
        profile.pass0_vendor || null,
        profile.pass0_has_api ?? null,
        profile.pass0_has_portal ?? null,
        profile.pass0_inspections_linked ?? null,
        profile.pass2_method || null,
        profile.pass2_coverage || null,
        profile.pass2_zoning_model_detected || null,
        profile.pass2_ordinance_format || null,
        profile.pass2_has_gis ?? null,
        profile.pass2_has_online_ordinance ?? null,
        profile.pass2_planning_url || null,
        profile.pass2_ordinance_url || null,
        profile.confidence || 'low',
        profile.ttl_months || 12,
      ]
    );
    return result.rows[0];
  }

  /**
   * Check if CCA needs refresh.
   */
  async ccaNeedsRefresh(countyId: number): Promise<boolean> {
    const result = await this.executeRaw<{ needs_refresh: boolean }>(
      `SELECT (expires_at < NOW()) AS needs_refresh FROM ref.county_capability WHERE county_id = $1`,
      [countyId]
    );
    if (result.rows.length === 0) return true; // No record = needs probe
    return result.rows[0].needs_refresh;
  }

  // ===========================================================================
  // JURISDICTION CARD OPERATIONS (pass2.*)
  // ===========================================================================

  /**
   * Get jurisdiction card for Pass 3 consumption.
   * Uses the v_jurisdiction_card_for_pass3 view.
   */
  async getJurisdictionCard(countyId: number): Promise<JurisdictionCardRecord | null> {
    const result = await this.executeRaw<JurisdictionCardRecord>(
      `SELECT * FROM pass2.v_jurisdiction_card_for_pass3 WHERE county_id = $1`,
      [countyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if envelope is complete for a county.
   */
  async isEnvelopeComplete(countyId: number): Promise<boolean> {
    const result = await this.executeRaw<{ envelope_complete: boolean }>(
      `SELECT pass2.is_envelope_complete($1) AS envelope_complete`,
      [countyId]
    );
    return result.rows[0]?.envelope_complete ?? false;
  }

  /**
   * Check if county has fatal prohibition.
   */
  async hasFatalProhibition(countyId: number): Promise<boolean> {
    const result = await this.executeRaw<{ has_fatal: boolean }>(
      `SELECT pass2.has_fatal_prohibition($1) AS has_fatal`,
      [countyId]
    );
    return result.rows[0]?.has_fatal ?? false;
  }

  // ===========================================================================
  // VAULT OPERATIONS
  // ===========================================================================
  //
  // NOTE: Pass 2 upsert functions (upsertJurisdictionScope, upsertZoningEnvelope)
  // have been REMOVED per Vault Guardian doctrine. Pass 2 must write to Supabase
  // staging tables. Data is promoted to Neon only via promoteXxxToVault() functions.
  //

  /**
   * Insert a record into the vault.
   */
  async insertVaultRecord(record: Omit<NeonVaultRecord, 'id' | 'created_at' | 'updated_at'>): Promise<NeonVaultRecord> {
    const result = await this.executeRaw<NeonVaultRecord>(
      `INSERT INTO vault.opportunities (
        run_id, pass1_run_id, zip_code, state, verdict,
        deal_index, noi, noi_per_acre_monthly, passes_doctrine,
        cap_rate, dscr, fatal_flaws,
        feasibility_score, demand_score, competitive_score, zoning_score,
        stamped, stamp_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        record.run_id,
        record.pass1_run_id,
        record.zip_code,
        record.state,
        record.verdict,
        record.deal_index,
        record.noi,
        record.noi_per_acre_monthly,
        record.passes_doctrine,
        record.cap_rate,
        record.dscr,
        JSON.stringify(record.fatal_flaws),
        record.feasibility_score,
        record.demand_score,
        record.competitive_score,
        record.zoning_score,
        record.stamped,
        record.stamp_timestamp,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an existing vault record.
   */
  async updateVaultRecord(id: string, updates: Partial<NeonVaultRecord>): Promise<NeonVaultRecord> {
    // Build dynamic update query
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(key === 'fatal_flaws' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.executeRaw<NeonVaultRecord>(
      `UPDATE vault.opportunities SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Get a vault record by ID.
   */
  async getVaultRecord(id: string): Promise<NeonVaultRecord | null> {
    const result = await this.executeRaw<NeonVaultRecord>(
      `SELECT * FROM vault.opportunities WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Query vault records with filters.
   */
  async queryVault(
    filters: Partial<Pick<NeonVaultRecord, 'zip_code' | 'state' | 'verdict'>>
  ): Promise<NeonQueryResult<NeonVaultRecord>> {
    const whereClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.zip_code) {
      whereClauses.push(`zip_code = $${paramIndex++}`);
      values.push(filters.zip_code);
    }
    if (filters.state) {
      whereClauses.push(`state = $${paramIndex++}`);
      values.push(filters.state);
    }
    if (filters.verdict) {
      whereClauses.push(`verdict = $${paramIndex++}`);
      values.push(filters.verdict);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return this.executeRaw<NeonVaultRecord>(
      `SELECT * FROM vault.opportunities ${whereClause} ORDER BY created_at DESC`,
      values
    );
  }

  // ===========================================================================
  // HEALTH & LIFECYCLE
  // ===========================================================================

  /**
   * Check connection health.
   */
  async healthCheck(): Promise<{ connected: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.executeRaw('SELECT 1');
      return {
        connected: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Close the connection pool.
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      console.log('[NeonAdapter] Connection pool closed');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton NeonAdapter instance
 *
 * WARNING: Do not import this in Pass 0 code.
 * CI checks will fail if Pass 0 references NeonAdapter.
 */
export const neonAdapter = new NeonAdapter();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get CCA profile for a county.
 */
export async function getCcaProfile(countyId: number): Promise<CountyCapabilityRecord | null> {
  return neonAdapter.getCcaProfile(countyId);
}

/**
 * Get jurisdiction card for Pass 3.
 */
export async function getJurisdictionCard(countyId: number): Promise<JurisdictionCardRecord | null> {
  return neonAdapter.getJurisdictionCard(countyId);
}

/**
 * Check if envelope is complete.
 */
export async function isEnvelopeComplete(countyId: number): Promise<boolean> {
  return neonAdapter.isEnvelopeComplete(countyId);
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { NeonAdapterConfig, NeonVaultRecord, NeonQueryResult, CountyCapabilityRecord, JurisdictionCardRecord };
