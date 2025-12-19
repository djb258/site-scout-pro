import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * CCA_DISPATCH_RECON Edge Function (v2.0.0)
 * 
 * DOCTRINE: Lovable orchestrates. Never decides automation methods.
 * Updated to use ref.v_cca_dispatch view matching Claude Code spec.
 * 
 * Responsibilities:
 * 1. Resolve ZIP + radius → counties
 * 2. Dedupe against Neon via ref.v_cca_dispatch (TTL check)
 * 3. Build minimal dispatch payload (identity only)
 * 4. Return payload for Claude Code agent
 * 
 * process_id: cca_dispatch_recon
 * version: v2.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatchInput {
  zip: string;
  radius_miles?: number;
  force_refresh?: boolean;
  passes_needed?: ('pass0' | 'pass2')[];
}

interface CountyDispatch {
  county_id: number | null;
  county_name: string;
  state: string;
  county_fips?: string;
  recon_type: 'full' | 'refresh' | 'partial';
  passes_needed: string[];
  stale_since?: string;
  current_methods?: {
    pass0_method: string;
    pass0_coverage: string;
    pass2_method: string;
    pass2_coverage: string;
  };
}

interface DispatchResult {
  dispatch_id: string;
  status: 'dispatched' | 'all_fresh' | 'error';
  counties_to_recon: CountyDispatch[];
  counties_fresh: string[];
  timestamp: string;
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const input: DispatchInput = await req.json();
    const { zip, radius_miles = 10, force_refresh = false, passes_needed = ['pass0', 'pass2'] } = input;

    if (!zip) {
      return new Response(
        JSON.stringify({ error: 'zip is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dispatch_id = crypto.randomUUID();
    console.log(`[CCA_DISPATCH v2] Starting dispatch ${dispatch_id} for ZIP: ${zip}, radius: ${radius_miles}mi`);

    // Connect to Neon
    sql = await getNeonConnection();

    // =========================================================================
    // STEP 1: Resolve ZIP → Counties (within radius)
    // =========================================================================
    const zipResult = await sql`
      SELECT zip, city, county_name, state_id as state, lat, lng, county_fips
      FROM zips_master
      WHERE zip = ${zip}
      LIMIT 1
    `;

    if (zipResult.length === 0) {
      await sql.end();
      return new Response(
        JSON.stringify({ error: `ZIP ${zip} not found`, dispatch_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const originZip = zipResult[0];
    console.log(`[CCA_DISPATCH v2] Origin: ${originZip.city}, ${originZip.county_name}, ${originZip.state}`);

    // Get counties within radius
    const radiusCounties = await sql`
      SELECT DISTINCT county_name, state_id as state, county_fips
      FROM zips_master
      WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND ${originZip.lat} IS NOT NULL AND ${originZip.lng} IS NOT NULL
        AND (
          3959 * acos(
            cos(radians(${originZip.lat})) * cos(radians(lat)) *
            cos(radians(lng) - radians(${originZip.lng})) +
            sin(radians(${originZip.lat})) * sin(radians(lat))
          )
        ) <= ${radius_miles}
      ORDER BY county_name
    `;

    console.log(`[CCA_DISPATCH v2] Found ${radiusCounties.length} counties within ${radius_miles}mi radius`);

    // =========================================================================
    // STEP 2: Dedupe against ref.v_cca_dispatch (TTL check)
    // =========================================================================
    const countiesToRecon: CountyDispatch[] = [];
    const countiesFresh: string[] = [];

    for (const county of radiusCounties) {
      // Check existing CCA profile via dispatch view
      const profileResult = await sql`
        SELECT 
          county_id,
          pass0_method,
          pass0_coverage,
          pass2_method,
          pass2_coverage,
          verified_at,
          is_expired,
          expires_soon
        FROM ref.v_cca_dispatch
        WHERE county_name ILIKE ${county.county_name}
          AND state = ${county.state}
        LIMIT 1
      `.catch(() => []);

      const profile = profileResult[0];

      if (profile && !force_refresh && !profile.is_expired) {
        // Profile is fresh
        countiesFresh.push(`${county.county_name}_${county.state}`);
        console.log(`[CCA_DISPATCH v2] ${county.county_name}, ${county.state}: fresh`);
        continue;
      }

      if (profile) {
        // Profile exists but is stale/expired or force refresh
        countiesToRecon.push({
          county_id: profile.county_id,
          county_name: county.county_name,
          state: county.state,
          county_fips: county.county_fips,
          recon_type: 'refresh',
          passes_needed,
          stale_since: profile.verified_at,
          current_methods: {
            pass0_method: profile.pass0_method,
            pass0_coverage: profile.pass0_coverage,
            pass2_method: profile.pass2_method,
            pass2_coverage: profile.pass2_coverage,
          },
        });
        console.log(`[CCA_DISPATCH v2] ${county.county_name}, ${county.state}: stale, needs refresh`);
      } else {
        // No profile exists
        countiesToRecon.push({
          county_id: null,
          county_name: county.county_name,
          state: county.state,
          county_fips: county.county_fips,
          recon_type: 'full',
          passes_needed,
        });
        console.log(`[CCA_DISPATCH v2] ${county.county_name}, ${county.state}: new recon needed`);
      }
    }

    // =========================================================================
    // STEP 3: Build dispatch result
    // =========================================================================
    const result: DispatchResult = {
      dispatch_id,
      status: countiesToRecon.length > 0 ? 'dispatched' : 'all_fresh',
      counties_to_recon: countiesToRecon,
      counties_fresh: countiesFresh,
      timestamp: new Date().toISOString(),
    };

    // Log dispatch event
    await supabase.from('engine_logs').insert({
      engine: 'cca_dispatch_recon',
      event: 'dispatch_v2',
      payload: {
        dispatch_id,
        origin_zip: zip,
        radius_miles,
        force_refresh,
        passes_needed,
        counties_to_recon: countiesToRecon.length,
        counties_fresh: countiesFresh.length,
      },
      status: result.status,
    });

    console.log(`[CCA_DISPATCH v2] Dispatch ${dispatch_id}: ${countiesToRecon.length} to recon, ${countiesFresh.length} fresh`);

    await sql.end();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CCA_DISPATCH v2] Error:', error);
    if (sql) await sql.end();
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
