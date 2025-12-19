import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * CCA_WRITE_PROFILE Edge Function
 * 
 * DOCTRINE: Receives structured JSON from Claude Code and persists to Neon.
 * 
 * Responsibilities:
 * 1. Validate incoming payload from Claude Code
 * 2. Enforce TTL governance (block writes if not stale unless forced)
 * 3. Persist to Neon with versioning
 * 4. Log write event
 * 
 * process_id: cca_write_profile
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid methods (must match Neon constraints)
const VALID_PASS0_METHODS = ['scrape_energov', 'scrape_onestop', 'scrape_accela', 'api_permit', 'scrape_custom', 'manual'];
const VALID_PASS2_METHODS = ['api_zoning', 'scrape_gis', 'pdf_ocr', 'scrape_custom', 'manual'];
const VALID_RECON_SOURCES = ['claude_code', 'manual_override', 'system'];

interface CCAProfilePayload {
  county_id: string;
  county_name: string;
  state: string;
  
  pass0_method: string;
  pass0_source_url?: string;
  pass0_automation_confidence?: number;
  pass0_notes?: string;
  
  pass2_method: string;
  pass2_source_url?: string;
  pass2_automation_confidence?: number;
  pass2_notes?: string;
  
  recon_performed_by: string;
  recon_notes?: string;
  source_evidence?: any[];
  
  force_write?: boolean;
}

interface WriteResult {
  status: 'written' | 'blocked_ttl' | 'validation_error' | 'error';
  county_id: string;
  message: string;
  previous_verified_at?: string;
  new_verified_at?: string;
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

  if (!payload.county_id) errors.push('county_id is required');
  if (!payload.county_name) errors.push('county_name is required');
  if (!payload.state) errors.push('state is required');
  
  if (!payload.pass0_method) {
    errors.push('pass0_method is required');
  } else if (!VALID_PASS0_METHODS.includes(payload.pass0_method)) {
    errors.push(`pass0_method must be one of: ${VALID_PASS0_METHODS.join(', ')}`);
  }
  
  if (!payload.pass2_method) {
    errors.push('pass2_method is required');
  } else if (!VALID_PASS2_METHODS.includes(payload.pass2_method)) {
    errors.push(`pass2_method must be one of: ${VALID_PASS2_METHODS.join(', ')}`);
  }
  
  if (!payload.recon_performed_by) {
    errors.push('recon_performed_by is required');
  } else if (!VALID_RECON_SOURCES.includes(payload.recon_performed_by)) {
    errors.push(`recon_performed_by must be one of: ${VALID_RECON_SOURCES.join(', ')}`);
  }

  if (payload.pass0_automation_confidence !== undefined) {
    if (payload.pass0_automation_confidence < 0 || payload.pass0_automation_confidence > 1) {
      errors.push('pass0_automation_confidence must be between 0 and 1');
    }
  }

  if (payload.pass2_automation_confidence !== undefined) {
    if (payload.pass2_automation_confidence < 0 || payload.pass2_automation_confidence > 1) {
      errors.push('pass2_automation_confidence must be between 0 and 1');
    }
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

    console.log(`[CCA_WRITE] Received profile for: ${payload.county_id}`);

    // =========================================================================
    // STEP 1: Validate payload
    // =========================================================================
    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      const result: WriteResult = {
        status: 'validation_error',
        county_id: payload.county_id || 'unknown',
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
    // STEP 2: Check TTL governance
    // =========================================================================
    const existingProfile = await sql`
      SELECT 
        verified_at,
        ttl_days,
        (verified_at + (ttl_days || ' days')::interval) as expires_at
      FROM ref.cca_county_profile
      WHERE county_id = ${payload.county_id}
      LIMIT 1
    `.catch(() => []);

    if (existingProfile.length > 0 && !payload.force_write) {
      const profile = existingProfile[0];
      const expiresAt = new Date(profile.expires_at);
      const now = new Date();

      if (expiresAt > now) {
        // Profile is still fresh - block write
        const result: WriteResult = {
          status: 'blocked_ttl',
          county_id: payload.county_id,
          message: `Profile is fresh until ${expiresAt.toISOString()}. Use force_write=true to override.`,
          previous_verified_at: profile.verified_at,
        };

        console.log(`[CCA_WRITE] Blocked write for ${payload.county_id}: TTL not expired`);

        await sql.end();
        return new Response(
          JSON.stringify(result),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // STEP 3: Upsert to Neon
    // =========================================================================
    const now = new Date().toISOString();
    
    await sql`
      INSERT INTO ref.cca_county_profile (
        county_id,
        county_name,
        state,
        pass0_method,
        pass0_source_url,
        pass0_automation_confidence,
        pass0_notes,
        pass2_method,
        pass2_source_url,
        pass2_automation_confidence,
        pass2_notes,
        recon_performed_by,
        recon_notes,
        source_evidence,
        verified_at
      ) VALUES (
        ${payload.county_id},
        ${payload.county_name},
        ${payload.state},
        ${payload.pass0_method},
        ${payload.pass0_source_url || null},
        ${payload.pass0_automation_confidence || null},
        ${payload.pass0_notes || null},
        ${payload.pass2_method},
        ${payload.pass2_source_url || null},
        ${payload.pass2_automation_confidence || null},
        ${payload.pass2_notes || null},
        ${payload.recon_performed_by},
        ${payload.recon_notes || null},
        ${JSON.stringify(payload.source_evidence || [])},
        ${now}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        pass0_method = EXCLUDED.pass0_method,
        pass0_source_url = EXCLUDED.pass0_source_url,
        pass0_automation_confidence = EXCLUDED.pass0_automation_confidence,
        pass0_notes = EXCLUDED.pass0_notes,
        pass2_method = EXCLUDED.pass2_method,
        pass2_source_url = EXCLUDED.pass2_source_url,
        pass2_automation_confidence = EXCLUDED.pass2_automation_confidence,
        pass2_notes = EXCLUDED.pass2_notes,
        recon_performed_by = EXCLUDED.recon_performed_by,
        recon_notes = EXCLUDED.recon_notes,
        source_evidence = EXCLUDED.source_evidence,
        verified_at = EXCLUDED.verified_at
    `;

    const result: WriteResult = {
      status: 'written',
      county_id: payload.county_id,
      message: `Profile written successfully`,
      previous_verified_at: existingProfile[0]?.verified_at,
      new_verified_at: now,
    };

    // Log write event
    await supabase.from('engine_logs').insert({
      engine: 'cca_write_profile',
      event: 'profile_written',
      payload: {
        county_id: payload.county_id,
        pass0_method: payload.pass0_method,
        pass2_method: payload.pass2_method,
        recon_performed_by: payload.recon_performed_by,
        force_write: payload.force_write || false,
        was_update: existingProfile.length > 0,
      },
      status: 'success',
    });

    console.log(`[CCA_WRITE] Successfully wrote profile for ${payload.county_id}`);

    await sql.end();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CCA_WRITE] Error:', error);
    if (sql) await sql.end();

    return new Response(
      JSON.stringify({
        status: 'error',
        county_id: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
