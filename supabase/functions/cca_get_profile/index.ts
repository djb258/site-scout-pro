import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * CCA_GET_PROFILE Edge Function (v2.0.0)
 * 
 * DOCTRINE: Read-only hydration for UI. Never modifies data.
 * Updated to use ref.v_cca_dispatch view matching Claude Code spec.
 * 
 * Responsibilities:
 * 1. Fetch CCA profile from dispatch view
 * 2. Flag stale/expiring profiles
 * 3. Return full method details for routing
 * 
 * process_id: cca_get_profile
 * version: v2.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CCAProfile {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string | null;
  
  pass0: {
    method: string;
    coverage: string;
    vendor: string | null;
    source_url: string | null;
    has_api: boolean;
    has_portal: boolean;
  };
  
  pass2: {
    method: string;
    coverage: string;
    source_url: string | null;
    planning_url: string | null;
    ordinance_url: string | null;
    zoning_map_url: string | null;
  };
  
  metadata: {
    confidence: string;
    verified_at: string;
    expires_at: string;
    is_expired: boolean;
    expires_soon: boolean;
    days_until_expiry: number;
    version: number;
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

    // Query from ref.v_cca_dispatch view
    let profileResult;
    if (county_id) {
      profileResult = await sql`
        SELECT * FROM ref.v_cca_dispatch
        WHERE county_id = ${county_id}
        LIMIT 1
      `;
    } else {
      profileResult = await sql`
        SELECT * FROM ref.v_cca_dispatch
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

    const profile: CCAProfile = {
      county_id: row.county_id,
      state: row.state,
      county_name: row.county_name,
      county_fips: row.county_fips,
      pass0: {
        method: row.pass0_method,
        coverage: row.pass0_coverage,
        vendor: row.pass0_vendor,
        source_url: row.pass0_source_url,
        has_api: row.pass0_has_api,
        has_portal: row.pass0_has_portal,
      },
      pass2: {
        method: row.pass2_method,
        coverage: row.pass2_coverage,
        source_url: row.pass2_source_url,
        planning_url: row.pass2_planning_url,
        ordinance_url: row.pass2_ordinance_url,
        zoning_map_url: row.pass2_zoning_map_url,
      },
      metadata: {
        confidence: row.confidence,
        verified_at: row.verified_at,
        expires_at: row.expires_at,
        is_expired: row.is_expired,
        expires_soon: row.expires_soon,
        days_until_expiry: Math.round(row.days_until_expiry || 0),
        version: row.version,
      },
    };

    const result: GetProfileResult = {
      status: 'found',
      profile,
    };

    console.log(`[CCA_GET v2] Profile found: ${row.county_id}, expired: ${row.is_expired}, version: ${row.version}`);

    await sql.end();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CCA_GET v2] Error:', error);
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
