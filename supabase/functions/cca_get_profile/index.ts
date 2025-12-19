import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * CCA_GET_PROFILE Edge Function
 * 
 * DOCTRINE: Read-only hydration for UI. Never modifies data.
 * 
 * Responsibilities:
 * 1. Fetch CCA profile for display
 * 2. Flag stale profiles
 * 3. Return method details for routing
 * 
 * process_id: cca_get_profile
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CCAProfile {
  county_id: string;
  county_name: string;
  state: string;
  
  pass0: {
    method: string;
    source_url: string | null;
    automation_confidence: number | null;
    notes: string | null;
  };
  
  pass2: {
    method: string;
    source_url: string | null;
    automation_confidence: number | null;
    notes: string | null;
  };
  
  metadata: {
    recon_performed_by: string | null;
    recon_notes: string | null;
    source_evidence: any[];
    verified_at: string;
    expires_at: string;
    is_stale: boolean;
    days_until_stale: number;
  };
}

interface GetProfileResult {
  status: 'found' | 'not_found' | 'error';
  profile?: CCAProfile;
  message?: string;
}

async function getNeonConnection() {
  const neonUrl = Deno.env.get('NEON_DATABASE_URL');
  if (!neonUrl) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return postgres(neonUrl, { ssl: 'require' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const { county_id, county_name, state } = await req.json();

    // Need either county_id or (county_name + state)
    if (!county_id && (!county_name || !state)) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: 'Either county_id or (county_name + state) is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    sql = await getNeonConnection();

    // Build query based on input
    let profileResult;
    if (county_id) {
      profileResult = await sql`
        SELECT 
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
          verified_at,
          ttl_days,
          (verified_at + (ttl_days || ' days')::interval) as expires_at
        FROM ref.cca_county_profile
        WHERE county_id = ${county_id}
        LIMIT 1
      `;
    } else {
      profileResult = await sql`
        SELECT 
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
          verified_at,
          ttl_days,
          (verified_at + (ttl_days || ' days')::interval) as expires_at
        FROM ref.cca_county_profile
        WHERE county_name ILIKE ${county_name}
          AND state = ${state}
        LIMIT 1
      `;
    }

    if (profileResult.length === 0) {
      await sql.end();
      return new Response(
        JSON.stringify({ 
          status: 'not_found',
          message: `No CCA profile found for ${county_id || `${county_name}, ${state}`}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = profileResult[0];
    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    const isStale = expiresAt <= now;
    const daysUntilStale = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const profile: CCAProfile = {
      county_id: row.county_id,
      county_name: row.county_name,
      state: row.state,
      pass0: {
        method: row.pass0_method,
        source_url: row.pass0_source_url,
        automation_confidence: row.pass0_automation_confidence,
        notes: row.pass0_notes,
      },
      pass2: {
        method: row.pass2_method,
        source_url: row.pass2_source_url,
        automation_confidence: row.pass2_automation_confidence,
        notes: row.pass2_notes,
      },
      metadata: {
        recon_performed_by: row.recon_performed_by,
        recon_notes: row.recon_notes,
        source_evidence: row.source_evidence || [],
        verified_at: row.verified_at,
        expires_at: row.expires_at,
        is_stale: isStale,
        days_until_stale: isStale ? 0 : daysUntilStale,
      },
    };

    const result: GetProfileResult = {
      status: 'found',
      profile,
    };

    console.log(`[CCA_GET] Profile found: ${row.county_id}, stale: ${isStale}`);

    await sql.end();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CCA_GET] Error:', error);
    if (sql) await sql.end();

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
