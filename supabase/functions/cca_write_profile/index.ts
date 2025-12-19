import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * CCA_WRITE_PROFILE Edge Function (v2.0.0)
 * 
 * DOCTRINE: Receives structured JSON from Claude Code and persists to Neon.
 * Updated to use ref.county_capability schema matching Claude Code spec.
 * 
 * Responsibilities:
 * 1. Validate incoming payload from Claude Code
 * 2. Enforce TTL governance (block writes if not stale unless forced)
 * 3. Persist to Neon with versioning
 * 4. Log write event
 * 
 * process_id: cca_write_profile
 * version: v2.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid methods matching ref.automation_method ENUM
const VALID_METHODS = ['api', 'scrape', 'portal', 'manual'];
const VALID_COVERAGE = ['full', 'partial', 'insufficient'];
const VALID_CONFIDENCE = ['low', 'medium', 'high'];

interface CCAProfilePayload {
  // Identity (required)
  county_id: number;
  state: string;
  county_name: string;
  county_fips?: string;
  
  // Pass 0 Capability
  pass0_method: string;
  pass0_source_pointer?: string;
  pass0_coverage?: string;
  pass0_notes?: string;
  pass0_vendor?: string;
  pass0_has_api?: boolean;
  pass0_has_portal?: boolean;
  pass0_inspections_linked?: boolean;
  
  // Pass 2 Capability
  pass2_method: string;
  pass2_source_pointer?: string;
  pass2_coverage?: string;
  pass2_notes?: string;
  pass2_zoning_model_detected?: string;
  pass2_ordinance_format?: string;
  pass2_planning_url?: string;
  pass2_ordinance_url?: string;
  pass2_zoning_map_url?: string;
  
  // Meta
  confidence?: string;
  evidence_links?: string[];
  ttl_months?: number;
  
  // Control
  force_write?: boolean;
}

interface WriteResult {
  status: 'written' | 'blocked_ttl' | 'validation_error' | 'error';
  county_id: number;
  message: string;
  previous_verified_at?: string;
  new_verified_at?: string;
  version?: number;
}

async function getNeonConnection() {
  const neonUrl = Deno.env.get('NEON_DATABASE_URL');
  if (!neonUrl) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return postgres(neonUrl, { ssl: 'require' });
}

function validatePayload(payload: CCAProfilePayload): string[] {
  const errors: string[] = [];

  if (!payload.county_id) errors.push('county_id is required (must be BIGINT)');
  if (!payload.county_name) errors.push('county_name is required');
  if (!payload.state || payload.state.length !== 2) errors.push('state is required (2-char code)');
  
  if (!payload.pass0_method) {
    errors.push('pass0_method is required');
  } else if (!VALID_METHODS.includes(payload.pass0_method)) {
    errors.push(`pass0_method must be one of: ${VALID_METHODS.join(', ')}`);
  }
  
  if (!payload.pass2_method) {
    errors.push('pass2_method is required');
  } else if (!VALID_METHODS.includes(payload.pass2_method)) {
    errors.push(`pass2_method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  if (payload.pass0_coverage && !VALID_COVERAGE.includes(payload.pass0_coverage)) {
    errors.push(`pass0_coverage must be one of: ${VALID_COVERAGE.join(', ')}`);
  }

  if (payload.pass2_coverage && !VALID_COVERAGE.includes(payload.pass2_coverage)) {
    errors.push(`pass2_coverage must be one of: ${VALID_COVERAGE.join(', ')}`);
  }

  if (payload.confidence && !VALID_CONFIDENCE.includes(payload.confidence)) {
    errors.push(`confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`);
  }

  return errors;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: CCAProfilePayload = await req.json();

    console.log(`[CCA_WRITE v2] Received profile for county_id: ${payload.county_id}`);

    // =========================================================================
    // STEP 1: Validate payload
    // =========================================================================
    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      const result: WriteResult = {
        status: 'validation_error',
        county_id: payload.county_id || 0,
        message: `Validation failed: ${validationErrors.join('; ')}`,
      };
      return new Response(
        JSON.stringify(result),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Connect to Neon
    sql = await getNeonConnection();

    // =========================================================================
    // STEP 2: Check TTL governance using ref.needs_refresh()
    // =========================================================================
    const existingProfile = await sql`
      SELECT 
        county_id,
        verified_at,
        expires_at,
        version
      FROM ref.county_capability
      WHERE county_id = ${payload.county_id}
      LIMIT 1
    `.catch(() => []);

    if (existingProfile.length > 0 && !payload.force_write) {
      const profile = existingProfile[0];
      const expiresAt = new Date(profile.expires_at);
      const now = new Date();

      if (expiresAt > now) {
        const result: WriteResult = {
          status: 'blocked_ttl',
          county_id: payload.county_id,
          message: `Profile is fresh until ${expiresAt.toISOString()}. Use force_write=true to override.`,
          previous_verified_at: profile.verified_at,
          version: profile.version,
        };

        console.log(`[CCA_WRITE v2] Blocked write for ${payload.county_id}: TTL not expired`);

        await sql.end();
        return new Response(
          JSON.stringify(result),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // STEP 3: Upsert to Neon (ref.county_capability)
    // =========================================================================
    const now = new Date().toISOString();
    const newVersion = (existingProfile[0]?.version || 0) + 1;
    
    await sql`
      INSERT INTO ref.county_capability (
        county_id,
        state,
        county_name,
        county_fips,
        pass0_method,
        pass0_source_pointer,
        pass0_coverage,
        pass0_notes,
        pass0_vendor,
        pass0_has_api,
        pass0_has_portal,
        pass0_inspections_linked,
        pass2_method,
        pass2_source_pointer,
        pass2_coverage,
        pass2_notes,
        pass2_zoning_model_detected,
        pass2_ordinance_format,
        pass2_planning_url,
        pass2_ordinance_url,
        pass2_zoning_map_url,
        confidence,
        evidence_links,
        ttl_months,
        verified_at,
        version
      ) VALUES (
        ${payload.county_id},
        ${payload.state},
        ${payload.county_name},
        ${payload.county_fips || null},
        ${payload.pass0_method}::ref.automation_method,
        ${payload.pass0_source_pointer || null},
        ${payload.pass0_coverage || 'insufficient'}::ref.coverage_level,
        ${payload.pass0_notes || null},
        ${payload.pass0_vendor || null},
        ${payload.pass0_has_api ?? false},
        ${payload.pass0_has_portal ?? false},
        ${payload.pass0_inspections_linked ?? null},
        ${payload.pass2_method}::ref.automation_method,
        ${payload.pass2_source_pointer || null},
        ${payload.pass2_coverage || 'insufficient'}::ref.coverage_level,
        ${payload.pass2_notes || null},
        ${payload.pass2_zoning_model_detected || null},
        ${payload.pass2_ordinance_format || null},
        ${payload.pass2_planning_url || null},
        ${payload.pass2_ordinance_url || null},
        ${payload.pass2_zoning_map_url || null},
        ${payload.confidence || 'low'}::ref.recon_confidence,
        ${payload.evidence_links || null},
        ${payload.ttl_months || 12},
        ${now},
        ${newVersion}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        state = EXCLUDED.state,
        county_name = EXCLUDED.county_name,
        county_fips = EXCLUDED.county_fips,
        pass0_method = EXCLUDED.pass0_method,
        pass0_source_pointer = EXCLUDED.pass0_source_pointer,
        pass0_coverage = EXCLUDED.pass0_coverage,
        pass0_notes = EXCLUDED.pass0_notes,
        pass0_vendor = EXCLUDED.pass0_vendor,
        pass0_has_api = EXCLUDED.pass0_has_api,
        pass0_has_portal = EXCLUDED.pass0_has_portal,
        pass0_inspections_linked = EXCLUDED.pass0_inspections_linked,
        pass2_method = EXCLUDED.pass2_method,
        pass2_source_pointer = EXCLUDED.pass2_source_pointer,
        pass2_coverage = EXCLUDED.pass2_coverage,
        pass2_notes = EXCLUDED.pass2_notes,
        pass2_zoning_model_detected = EXCLUDED.pass2_zoning_model_detected,
        pass2_ordinance_format = EXCLUDED.pass2_ordinance_format,
        pass2_planning_url = EXCLUDED.pass2_planning_url,
        pass2_ordinance_url = EXCLUDED.pass2_ordinance_url,
        pass2_zoning_map_url = EXCLUDED.pass2_zoning_map_url,
        confidence = EXCLUDED.confidence,
        evidence_links = EXCLUDED.evidence_links,
        ttl_months = EXCLUDED.ttl_months,
        verified_at = EXCLUDED.verified_at,
        version = EXCLUDED.version
    `;

    const result: WriteResult = {
      status: 'written',
      county_id: payload.county_id,
      message: `Profile written successfully (v${newVersion})`,
      previous_verified_at: existingProfile[0]?.verified_at,
      new_verified_at: now,
      version: newVersion,
    };

    // Log write event
    await supabase.from('engine_logs').insert({
      engine: 'cca_write_profile',
      event: 'profile_written_v2',
      payload: {
        county_id: payload.county_id,
        state: payload.state,
        county_name: payload.county_name,
        pass0_method: payload.pass0_method,
        pass2_method: payload.pass2_method,
        confidence: payload.confidence,
        force_write: payload.force_write || false,
        was_update: existingProfile.length > 0,
        version: newVersion,
      },
      status: 'success',
    });

    console.log(`[CCA_WRITE v2] Successfully wrote profile for ${payload.county_id} (v${newVersion})`);

    await sql.end();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CCA_WRITE v2] Error:', error);
    if (sql) await sql.end();

    return new Response(
      JSON.stringify({
        status: 'error',
        county_id: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
