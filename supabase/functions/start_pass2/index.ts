import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

/**
 * START_PASS2 Edge Function — Constraint Compiler
 * 
 * DOCTRINE: This is a RELAY, not an ENGINE.
 * - Lovable.dev is a cockpit, not an engine
 * - All authoritative data comes from Neon
 * - No local computation, no inference, no guessing
 * 
 * process_id: start_pass2
 * version: v2.0.0
 * 
 * DO NOT MODIFY — downstream depends on this shape
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// RESPONSE CONTRACT (UI-SAFE PAYLOAD)
// ============================================================================

interface Pass2Response {
  status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO' | 'SCHEMA_INCOMPLETE';
  jurisdiction_card_complete: boolean;
  missing_required_fields: string[];
  blocked_fields: string[];
  fatal_prohibitions: string[];
  county_capability: {
    automation_viable: boolean;
    permit_system: string;
    zoning_model: string;
    county_name: string;
    state: string;
  } | null;
  next_actions: string[];
  zip_metadata: {
    zip: string;
    city: string | null;
    county: string | null;
    state: string | null;
    population: number | null;
  } | null;
  schema_status: {
    jurisdiction_cards_exists: boolean;
    jurisdiction_constraints_exists: boolean;
    jurisdiction_prohibitions_exists: boolean;
    ref_county_capability_exists: boolean;
  };
  timestamp: string;
}

// Required fields for a complete jurisdiction card
const REQUIRED_JURISDICTION_FIELDS = [
  'front_setback_ft',
  'side_setback_ft', 
  'rear_setback_ft',
  'max_lot_coverage_pct',
  'max_building_height_ft',
  'min_parking_spaces',
  'zoning_code',
  'storage_permitted',
];

// Fields that cannot be automated
const NON_AUTOMATABLE_FIELDS = [
  'fire_lane_width_ft',
  'stormwater_requirements',
  'conditional_use_process',
  'variance_history',
];

// ============================================================================
// NEON CONNECTION HELPER
// ============================================================================

async function getNeonConnection() {
  const neonUrl = Deno.env.get('NEON_DATABASE_URL');
  if (!neonUrl) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return postgres(neonUrl, { ssl: 'require' });
}

// ============================================================================
// TABLE EXISTENCE CHECK
// ============================================================================

async function checkTableExists(sql: any, schema: string, tableName: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = ${schema} 
        AND table_name = ${tableName}
      ) as exists
    `;
    return result[0]?.exists ?? false;
  } catch (error) {
    console.error(`[start_pass2] Error checking table ${schema}.${tableName}:`, error);
    return false;
  }
}

// ============================================================================
// DATA FETCHERS (READ-ONLY)
// ============================================================================

async function fetchZipMetadata(sql: any, zip: string) {
  try {
    const result = await sql`
      SELECT zip, city, county_name as county, state_id as state, population
      FROM zips_master
      WHERE zip = ${zip}
      LIMIT 1
    `;
    return result[0] || null;
  } catch (error) {
    console.error('[start_pass2] Error fetching ZIP metadata:', error);
    return null;
  }
}

async function fetchCountyCapability(sql: any, countyName: string, state: string) {
  try {
    // Check if table exists first
    const tableExists = await checkTableExists(sql, 'ref', 'ref_county_capability');
    if (!tableExists) {
      return null;
    }
    
    const result = await sql`
      SELECT 
        county_name,
        state,
        automation_viable,
        permit_system,
        zoning_model
      FROM ref.ref_county_capability
      WHERE county_name ILIKE ${countyName}
      AND state = ${state}
      LIMIT 1
    `;
    return result[0] || null;
  } catch (error) {
    console.error('[start_pass2] Error fetching county capability:', error);
    return null;
  }
}

async function fetchJurisdictionCard(sql: any, countyName: string, state: string) {
  try {
    const tableExists = await checkTableExists(sql, 'pass2', 'jurisdiction_cards');
    if (!tableExists) {
      return { exists: false, data: null };
    }
    
    const result = await sql`
      SELECT *
      FROM pass2.jurisdiction_cards
      WHERE county_name ILIKE ${countyName}
      AND state = ${state}
      LIMIT 1
    `;
    return { exists: true, data: result[0] || null };
  } catch (error) {
    console.error('[start_pass2] Error fetching jurisdiction card:', error);
    return { exists: false, data: null };
  }
}

async function fetchJurisdictionProhibitions(sql: any, countyName: string, state: string) {
  try {
    const tableExists = await checkTableExists(sql, 'pass2', 'jurisdiction_prohibitions');
    if (!tableExists) {
      return { exists: false, data: [] };
    }
    
    const result = await sql`
      SELECT prohibition_type, description, severity
      FROM pass2.jurisdiction_prohibitions
      WHERE county_name ILIKE ${countyName}
      AND state = ${state}
      AND severity = 'fatal'
    `;
    return { exists: true, data: result || [] };
  } catch (error) {
    console.error('[start_pass2] Error fetching prohibitions:', error);
    return { exists: false, data: [] };
  }
}

// ============================================================================
// CONSTRAINT ANALYSIS (NO COMPUTATION - JUST DATA TRANSFORMATION)
// ============================================================================

function analyzeConstraints(
  jurisdictionCard: any | null,
  prohibitions: any[],
  countyCapability: any | null
): { 
  status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO';
  missing_required_fields: string[];
  blocked_fields: string[];
  fatal_prohibitions: string[];
  next_actions: string[];
  jurisdiction_card_complete: boolean;
} {
  const missing_required_fields: string[] = [];
  const blocked_fields: string[] = [];
  const fatal_prohibitions: string[] = [];
  const next_actions: string[] = [];
  
  // Check for fatal prohibitions first
  if (prohibitions.length > 0) {
    prohibitions.forEach(p => {
      fatal_prohibitions.push(`${p.prohibition_type}: ${p.description}`);
    });
  }
  
  // If fatal prohibitions exist, immediate NO_GO
  if (fatal_prohibitions.length > 0) {
    return {
      status: 'NO_GO',
      missing_required_fields,
      blocked_fields,
      fatal_prohibitions,
      next_actions: ['Review prohibition details before proceeding'],
      jurisdiction_card_complete: false,
    };
  }
  
  // Check jurisdiction card completeness
  if (!jurisdictionCard) {
    // No card at all
    missing_required_fields.push(...REQUIRED_JURISDICTION_FIELDS);
    next_actions.push('Manual research required: county planning department');
    next_actions.push('Contact jurisdiction for zoning and setback requirements');
  } else {
    // Check each required field
    REQUIRED_JURISDICTION_FIELDS.forEach(field => {
      if (jurisdictionCard[field] === null || jurisdictionCard[field] === undefined) {
        missing_required_fields.push(field);
      }
    });
    
    // Check storage permission
    if (jurisdictionCard.storage_permitted === false) {
      fatal_prohibitions.push('ZONING_PROHIBITED: Self-storage not permitted in this jurisdiction');
    }
  }
  
  // Add non-automatable fields that need manual work
  NON_AUTOMATABLE_FIELDS.forEach(field => {
    if (!jurisdictionCard || jurisdictionCard[field] === null || jurisdictionCard[field] === undefined) {
      blocked_fields.push(field);
    }
  });
  
  // Add next actions based on county capability
  if (countyCapability) {
    if (!countyCapability.automation_viable) {
      next_actions.push(`Manual research required: ${countyCapability.permit_system || 'manual_only'} permit system`);
    }
    if (countyCapability.zoning_model === 'no_zoning') {
      next_actions.push('No formal zoning - verify county building requirements');
    }
  } else {
    next_actions.push('County capability data not available - assume manual research required');
  }
  
  // Add specific next actions for missing fields
  if (missing_required_fields.includes('front_setback_ft') || 
      missing_required_fields.includes('side_setback_ft') ||
      missing_required_fields.includes('rear_setback_ft')) {
    next_actions.push('Obtain setback requirements from planning department');
  }
  
  if (missing_required_fields.includes('max_lot_coverage_pct')) {
    next_actions.push('Verify lot coverage limits from zoning ordinance');
  }
  
  if (blocked_fields.includes('fire_lane_width_ft')) {
    next_actions.push('Retell call queued for fire access requirements');
  }
  
  // Determine final status
  const jurisdiction_card_complete = missing_required_fields.length === 0;
  
  let status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO';
  if (fatal_prohibitions.length > 0) {
    status = 'NO_GO';
  } else if (missing_required_fields.length > 0 || blocked_fields.length > 0) {
    status = 'HOLD_INCOMPLETE';
  } else {
    status = 'ELIGIBLE';
  }
  
  return {
    status,
    missing_required_fields,
    blocked_fields,
    fatal_prohibitions,
    next_actions,
    jurisdiction_card_complete,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sql: any = null;
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { zip, asset_class = 'self_storage' } = await req.json();

    if (!zip) {
      return new Response(
        JSON.stringify({ error: 'zip is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass2] Constraint compilation for ZIP: ${zip}, asset_class: ${asset_class}`);

    // =========================================================================
    // STEP 1: Connect to Neon
    // =========================================================================
    try {
      sql = await getNeonConnection();
    } catch (error) {
      console.error('[start_pass2] Neon connection failed:', error);
      
      // Return schema incomplete response
      const response: Pass2Response = {
        status: 'SCHEMA_INCOMPLETE',
        jurisdiction_card_complete: false,
        missing_required_fields: REQUIRED_JURISDICTION_FIELDS,
        blocked_fields: NON_AUTOMATABLE_FIELDS,
        fatal_prohibitions: [],
        county_capability: null,
        next_actions: ['Neon database connection not available', 'Configure NEON_DATABASE_URL secret'],
        zip_metadata: null,
        schema_status: {
          jurisdiction_cards_exists: false,
          jurisdiction_constraints_exists: false,
          jurisdiction_prohibitions_exists: false,
          ref_county_capability_exists: false,
        },
        timestamp: new Date().toISOString(),
      };
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // STEP 2: Resolve ZIP → County
    // =========================================================================
    const zipMetadata = await fetchZipMetadata(sql, zip);
    
    if (!zipMetadata) {
      console.log(`[start_pass2] ZIP ${zip} not found in Neon`);
      
      const response: Pass2Response = {
        status: 'HOLD_INCOMPLETE',
        jurisdiction_card_complete: false,
        missing_required_fields: REQUIRED_JURISDICTION_FIELDS,
        blocked_fields: NON_AUTOMATABLE_FIELDS,
        fatal_prohibitions: [],
        county_capability: null,
        next_actions: [`ZIP ${zip} not found in database`, 'Verify ZIP code and retry'],
        zip_metadata: null,
        schema_status: {
          jurisdiction_cards_exists: true,
          jurisdiction_constraints_exists: true,
          jurisdiction_prohibitions_exists: true,
          ref_county_capability_exists: true,
        },
        timestamp: new Date().toISOString(),
      };
      
      await sql.end();
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const countyName = zipMetadata.county;
    const state = zipMetadata.state;

    console.log(`[start_pass2] Resolved to county: ${countyName}, state: ${state}`);

    // =========================================================================
    // STEP 3: Check Schema Status
    // =========================================================================
    const schemaStatus = {
      jurisdiction_cards_exists: await checkTableExists(sql, 'pass2', 'jurisdiction_cards'),
      jurisdiction_constraints_exists: await checkTableExists(sql, 'pass2', 'jurisdiction_constraints'),
      jurisdiction_prohibitions_exists: await checkTableExists(sql, 'pass2', 'jurisdiction_prohibitions'),
      ref_county_capability_exists: await checkTableExists(sql, 'ref', 'ref_county_capability'),
    };

    console.log('[start_pass2] Schema status:', schemaStatus);

    // =========================================================================
    // STEP 4: Fetch Data from Neon (READ-ONLY)
    // =========================================================================
    const [countyCapability, jurisdictionCardResult, prohibitionsResult] = await Promise.all([
      fetchCountyCapability(sql, countyName, state),
      fetchJurisdictionCard(sql, countyName, state),
      fetchJurisdictionProhibitions(sql, countyName, state),
    ]);

    // =========================================================================
    // STEP 5: Analyze Constraints (NO COMPUTATION)
    // =========================================================================
    const analysis = analyzeConstraints(
      jurisdictionCardResult.data,
      prohibitionsResult.data,
      countyCapability
    );

    // =========================================================================
    // STEP 6: Build Response
    // =========================================================================
    const response: Pass2Response = {
      status: analysis.status,
      jurisdiction_card_complete: analysis.jurisdiction_card_complete,
      missing_required_fields: analysis.missing_required_fields,
      blocked_fields: analysis.blocked_fields,
      fatal_prohibitions: analysis.fatal_prohibitions,
      county_capability: countyCapability ? {
        automation_viable: countyCapability.automation_viable ?? false,
        permit_system: countyCapability.permit_system ?? 'unknown',
        zoning_model: countyCapability.zoning_model ?? 'unknown',
        county_name: countyName,
        state: state,
      } : {
        automation_viable: false,
        permit_system: 'unknown',
        zoning_model: 'unknown',
        county_name: countyName,
        state: state,
      },
      next_actions: analysis.next_actions,
      zip_metadata: {
        zip: zipMetadata.zip,
        city: zipMetadata.city,
        county: zipMetadata.county,
        state: zipMetadata.state,
        population: zipMetadata.population,
      },
      schema_status: schemaStatus,
      timestamp: new Date().toISOString(),
    };

    // =========================================================================
    // STEP 7: Log Event
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'start_pass2',
      event: 'constraint_compilation',
      payload: {
        zip,
        county: countyName,
        state,
        status: response.status,
        missing_fields_count: response.missing_required_fields.length,
        blocked_fields_count: response.blocked_fields.length,
        fatal_prohibitions_count: response.fatal_prohibitions.length,
      },
      status: response.status,
    });

    console.log(`[start_pass2] Completed with status: ${response.status}`);

    await sql.end();

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass2] Error:', error);
    
    if (sql) {
      await sql.end();
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'SCHEMA_INCOMPLETE',
        jurisdiction_card_complete: false,
        missing_required_fields: REQUIRED_JURISDICTION_FIELDS,
        blocked_fields: NON_AUTOMATABLE_FIELDS,
        fatal_prohibitions: [],
        county_capability: null,
        next_actions: ['System error occurred', 'Check logs for details'],
        zip_metadata: null,
        schema_status: {
          jurisdiction_cards_exists: false,
          jurisdiction_constraints_exists: false,
          jurisdiction_prohibitions_exists: false,
          ref_county_capability_exists: false,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
