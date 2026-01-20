import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// COUNTY MATCHING STRATEGY
// ============================================================
// 
// PRIMARY (preferred):
//   Match on county_fips if present in jurisdiction_card_drafts
//   This is the authoritative key once FIPS is promoted.
//
// FALLBACK (temporary bridge):
//   Match on state_code + normalized(county_name)
//   Normalization: lowercase, trim, strip "county"
//
// NOTE: jurisdiction_card_drafts does not yet expose county_fips
// as a first-class column. This fallback is a temporary bridge
// until FIPS is promoted. Name-based matching is fragile and
// logged for audit purposes.
// ============================================================

/**
 * Normalizes county names for fuzzy matching.
 * Used as FALLBACK when county_fips is not available.
 */
function normalizeCountyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+county$/i, '')  // Strip trailing "county"
    .replace(/\s+/g, ' ');       // Collapse whitespace
}

interface CountyInScope {
  county_name: string;
  county_fips: string;
  state_id: string;
  min_distance_miles: number;
  zip_count: number;
  total_population: number | null;
}

interface JurisdictionCardDraft {
  id: string;
  county_name: string | null;
  state_code: string;
  status: string | null;
  envelope_complete: boolean | null;
  collected_at: string | null;
  // NOTE: county_fips is not yet a first-class column
  // county_fips?: string;
}

type CardStatus = 'PRESENT' | 'PARTIAL' | 'MISSING';
type MatchType = 'fips' | 'name_fallback' | 'none';

interface CountyWithCardStatus extends CountyInScope {
  card_status: CardStatus;
  match_type: MatchType;
  card_details: {
    envelope_complete: boolean;
    status: string;
    collected_at: string;
  } | null;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sva_id from request
    let sva_id: string | null = null;
    const url = new URL(req.url);

    if (req.method === "GET") {
      sva_id = url.searchParams.get("sva_id");
    } else if (req.method === "POST") {
      const body = await req.json();
      sva_id = body.sva_id;
    }

    if (!sva_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sva_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch all counties in scope for this SVA
    const { data: countiesData, error: countiesError } = await supabase
      .from("sovereign_id_counties")
      .select("county_name, county_fips, state_id, min_distance_miles, zip_count, total_population")
      .eq("sva_id", sva_id)
      .order("min_distance_miles", { ascending: true });

    if (countiesError) {
      console.error("Failed to fetch counties:", countiesError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch counties" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const counties = (countiesData || []) as CountyInScope[];

    if (counties.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          counties: [],
          summary: { total: 0, present: 0, partial: 0, missing: 0 },
          warnings: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Fetch all jurisdiction card drafts (for matching)
    // We fetch all and match in memory to minimize queries
    const { data: cardsData, error: cardsError } = await supabase
      .from("jurisdiction_card_drafts")
      .select("id, county_name, state_code, status, envelope_complete, collected_at");

    if (cardsError) {
      console.error("Failed to fetch jurisdiction cards:", cardsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch jurisdiction cards" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cards = (cardsData || []) as JurisdictionCardDraft[];

    // Build lookup maps for efficient matching
    // NOTE: Currently building name-based lookup since FIPS is not yet available
    const cardsByStateAndName = new Map<string, JurisdictionCardDraft>();
    for (const card of cards) {
      if (card.county_name && card.state_code) {
        const normalizedName = normalizeCountyName(card.county_name);
        const key = `${card.state_code.toLowerCase()}:${normalizedName}`;
        // Keep the most complete card if duplicates exist
        const existing = cardsByStateAndName.get(key);
        if (!existing || (card.envelope_complete && !existing.envelope_complete)) {
          cardsByStateAndName.set(key, card);
        }
      }
    }

    // Step 3: Match each county to its jurisdiction card
    const results: CountyWithCardStatus[] = [];
    const warnings: string[] = [];
    let fallbackMatchCount = 0;

    for (const county of counties) {
      let matchedCard: JurisdictionCardDraft | null = null;
      let matchType: MatchType = 'none';

      // PRIMARY: Match on county_fips if available
      // NOTE: jurisdiction_card_drafts does not yet expose county_fips.
      // This block is a placeholder for when FIPS becomes a first-class column.
      // Currently, this will always fall through to the name-based fallback.
      // TODO: Uncomment when county_fips is added to jurisdiction_card_drafts
      /*
      const fipsKey = county.county_fips;
      const fipsMatch = cardsByFips.get(fipsKey);
      if (fipsMatch) {
        matchedCard = fipsMatch;
        matchType = 'fips';
      }
      */

      // FALLBACK: Match on state_code + normalized(county_name)
      // NOTE: This is a temporary name-based bridge until FIPS is promoted.
      if (!matchedCard) {
        const normalizedCountyName = normalizeCountyName(county.county_name);
        const key = `${county.state_id.toLowerCase()}:${normalizedCountyName}`;
        const nameMatch = cardsByStateAndName.get(key);
        
        if (nameMatch) {
          // WARN: Name-based match is fragile. Log for audit.
          console.warn(`FALLBACK_MATCH: ${county.county_fips} matched via name: ${county.county_name}`);
          matchedCard = nameMatch;
          matchType = 'name_fallback';
          fallbackMatchCount++;
        }
      }

      // Classify card status
      let cardStatus: CardStatus = 'MISSING';
      let cardDetails: CountyWithCardStatus['card_details'] = null;

      if (matchedCard) {
        if (matchedCard.status === 'validated' && matchedCard.envelope_complete) {
          cardStatus = 'PRESENT';
        } else {
          cardStatus = 'PARTIAL';
        }
        cardDetails = {
          envelope_complete: matchedCard.envelope_complete || false,
          status: matchedCard.status || 'unknown',
          collected_at: matchedCard.collected_at || ''
        };
      }

      results.push({
        ...county,
        card_status: cardStatus,
        match_type: matchType,
        card_details: cardDetails
      });
    }

    // Add warning if fallback matches were used
    if (fallbackMatchCount > 0) {
      warnings.push(
        `${fallbackMatchCount} counties matched via name_fallback (FIPS not available in jurisdiction_card_drafts)`
      );
    }

    // Calculate summary stats
    const summary = {
      total: results.length,
      present: results.filter(r => r.card_status === 'PRESENT').length,
      partial: results.filter(r => r.card_status === 'PARTIAL').length,
      missing: results.filter(r => r.card_status === 'MISSING').length
    };

    return new Response(
      JSON.stringify({
        success: true,
        counties: results,
        summary,
        warnings
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("County card status error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
