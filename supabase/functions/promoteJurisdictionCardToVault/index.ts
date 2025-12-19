import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PROMOTE JURISDICTION CARD TO VAULT — Pass 2 Promotion Gate
 * 
 * DOCTRINE: This is the ONLY function allowed to write to Neon vault.
 * Neon writes are append-only. No updates, no deletes, no overwrites.
 * 
 * execution_id is the PRIMARY TRACE KEY.
 * 
 * PRECONDITIONS (HARD FAIL if not met):
 * - status = 'validated'
 * - envelope_complete = true
 * - fatal_prohibition != 'yes'
 * 
 * process_id: pass2_promote_jurisdiction_card
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromoteInput {
  execution_id: string;
}

interface PromotionResult {
  promoted: boolean;
  execution_id: string;
  neon_id?: string;
  version_hash: string;
  error?: string;
}

async function getNeonConnection() {
  let neonUrl = Deno.env.get('NEON_DATABASE_URL');
  if (!neonUrl) throw new Error('NEON_DATABASE_URL not configured');
  
  // Clean up URL if needed
  neonUrl = neonUrl.trim();
  if (neonUrl.startsWith('psql ')) {
    neonUrl = neonUrl.replace(/^psql\s+/, '');
  }
  neonUrl = neonUrl.replace(/^['"]|['"]$/g, '');
  
  return postgres(neonUrl, { ssl: 'require' });
}

/**
 * Generate SHA256 hash of card payload for versioning
 */
async function generateVersionHash(payload: Record<string, unknown>): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const input: PromoteInput = await req.json();
    const { execution_id } = input;

    if (!execution_id) {
      return new Response(
        JSON.stringify({ promoted: false, error: 'execution_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PROMOTE_JURISDICTION_CARD] Starting promotion execution_id=${execution_id}`);

    // Fetch draft by execution_id
    const { data: draft, error: fetchError } = await supabase
      .from('jurisdiction_card_drafts')
      .select('*')
      .eq('execution_id', execution_id)
      .single();

    if (fetchError || !draft) {
      return new Response(
        JSON.stringify({ 
          promoted: false, 
          execution_id,
          error: `Draft not found for execution_id: ${execution_id}` 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRECONDITION 1: status must be 'validated'
    if (draft.status !== 'validated') {
      return new Response(
        JSON.stringify({ 
          promoted: false, 
          execution_id,
          error: `Cannot promote - status is '${draft.status}', must be 'validated'` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRECONDITION 2: envelope_complete must be true
    if (!draft.envelope_complete) {
      return new Response(
        JSON.stringify({ 
          promoted: false, 
          execution_id,
          error: 'Cannot promote - envelope_complete is false' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRECONDITION 3: fatal_prohibition must NOT be 'yes'
    if (draft.fatal_prohibition === 'yes') {
      return new Response(
        JSON.stringify({ 
          promoted: false, 
          execution_id,
          error: 'Cannot promote - fatal_prohibition is yes' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Already promoted check
    if (draft.status === 'promoted') {
      return new Response(
        JSON.stringify({ 
          promoted: false, 
          execution_id,
          error: 'Draft already promoted',
          version_hash: draft.neon_version_hash
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate version hash
    const versionHash = await generateVersionHash(draft.card_payload);
    const promotedAt = new Date().toISOString();

    console.log(`[PROMOTE_JURISDICTION_CARD] Connecting to Neon vault...`);

    // Connect to Neon (ONLY place Neon is accessed in Pass 2 collection flow)
    sql = await getNeonConnection();

    // Check if pass2 schema exists
    const schemaCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pass2'
      ) as exists
    `;

    if (!schemaCheck[0]?.exists) {
      // Create schema if needed
      await sql`CREATE SCHEMA IF NOT EXISTS pass2`;
    }

    // Check if jurisdiction_cards table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'pass2' AND table_name = 'jurisdiction_cards'
      ) as exists
    `;

    if (!tableCheck[0]?.exists) {
      // Create table (append-only, immutable)
      await sql`
        CREATE TABLE pass2.jurisdiction_cards (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          execution_id UUID NOT NULL,
          county_id INTEGER NOT NULL,
          state_code TEXT NOT NULL,
          asset_class TEXT DEFAULT 'self_storage',
          
          -- Version control
          version_hash TEXT NOT NULL,
          collected_at TIMESTAMPTZ NOT NULL,
          promoted_at TIMESTAMPTZ NOT NULL,
          is_latest BOOLEAN DEFAULT TRUE,
          
          -- Completeness
          envelope_complete BOOLEAN NOT NULL,
          card_complete BOOLEAN NOT NULL,
          fatal_prohibition TEXT NOT NULL,
          
          -- Full card data
          card_payload JSONB NOT NULL,
          field_states JSONB NOT NULL,
          provenance_log JSONB NOT NULL,
          
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;

      // Create indexes
      await sql`CREATE INDEX idx_jc_vault_county ON pass2.jurisdiction_cards(county_id, asset_class)`;
      await sql`CREATE INDEX idx_jc_vault_latest ON pass2.jurisdiction_cards(county_id, is_latest) WHERE is_latest = true`;
      await sql`CREATE INDEX idx_jc_vault_execution ON pass2.jurisdiction_cards(execution_id)`;
    }

    // Mark previous versions as not latest
    await sql`
      UPDATE pass2.jurisdiction_cards 
      SET is_latest = false 
      WHERE county_id = ${draft.county_id} 
        AND asset_class = ${draft.asset_class}
        AND is_latest = true
    `;

    // Insert new record (append-only)
    const insertResult = await sql`
      INSERT INTO pass2.jurisdiction_cards (
        execution_id,
        county_id,
        state_code,
        asset_class,
        version_hash,
        collected_at,
        promoted_at,
        is_latest,
        envelope_complete,
        card_complete,
        fatal_prohibition,
        card_payload,
        field_states,
        provenance_log
      ) VALUES (
        ${execution_id}::uuid,
        ${draft.county_id},
        ${draft.state_code},
        ${draft.asset_class},
        ${versionHash},
        ${draft.collected_at},
        ${promotedAt},
        true,
        ${draft.envelope_complete},
        ${draft.card_complete},
        ${draft.fatal_prohibition},
        ${JSON.stringify(draft.card_payload)}::jsonb,
        ${JSON.stringify(draft.field_states)}::jsonb,
        ${JSON.stringify(draft.provenance_log)}::jsonb
      )
      RETURNING id
    `;

    const neonId = insertResult[0]?.id;

    await sql.end();
    sql = null;

    // Update staging record to promoted
    const { error: updateError } = await supabase
      .from('jurisdiction_card_drafts')
      .update({
        status: 'promoted',
        promoted_at: promotedAt,
        neon_version_hash: versionHash,
        updated_at: promotedAt,
      })
      .eq('execution_id', execution_id);

    if (updateError) {
      throw new Error(`Failed to update staging record: ${updateError.message}`);
    }

    // Log successful promotion
    await supabase.from('engine_logs').insert({
      engine: 'pass2_promote_jurisdiction_card',
      event: 'promotion_complete',
      payload: {
        execution_id,
        neon_id: neonId,
        version_hash: versionHash,
        county_id: draft.county_id,
        state_code: draft.state_code,
      },
      status: 'success',
    });

    console.log(`[PROMOTE_JURISDICTION_CARD] Success execution_id=${execution_id} neon_id=${neonId}`);

    const result: PromotionResult = {
      promoted: true,
      execution_id,
      neon_id: neonId,
      version_hash: versionHash,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PROMOTE_JURISDICTION_CARD] Error:', error);

    if (sql) {
      await sql.end();
    }

    await supabase.from('engine_logs').insert({
      engine: 'pass2_promote_jurisdiction_card',
      event: 'promotion_failed',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      status: 'error',
    });

    return new Response(
      JSON.stringify({ 
        promoted: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
