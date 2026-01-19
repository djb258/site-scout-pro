import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sva_id and include flags from query params or body
    let sva_id: string | null = null;
    let includeZips = false;
    let includeCounties = false;

    const url = new URL(req.url);

    if (req.method === "GET") {
      sva_id = url.searchParams.get("sva_id");
      includeZips = url.searchParams.get("include_zips") === "true";
      includeCounties = url.searchParams.get("include_counties") === "true";
    } else if (req.method === "POST") {
      const body = await req.json();
      sva_id = body.sva_id;
      includeZips = body.include_zips === true;
      includeCounties = body.include_counties === true;
    }

    if (!sva_id) {
      return new Response(
        JSON.stringify({ error: "sva_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helpers to fetch >1000 rows (default max per query)
    const FETCH_BATCH_SIZE = 1000;

    async function fetchAllRowsOrdered<T>(opts: {
      table: string;
      select: string;
      orderBy: string;
      ascending?: boolean;
      eq: { column: string; value: string };
    }): Promise<T[]> {
      const out: T[] = [];
      let offset = 0;

      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from(opts.table)
          .select(opts.select)
          .eq(opts.eq.column, opts.eq.value)
          .order(opts.orderBy, { ascending: opts.ascending ?? true })
          .range(offset, offset + FETCH_BATCH_SIZE - 1);

        if (error) {
          throw new Error(`Failed to fetch ${opts.table}: ${error.message}`);
        }

        const batch = (data ?? []) as T[];
        out.push(...batch);

        if (batch.length < FETCH_BATCH_SIZE) break;
        offset += FETCH_BATCH_SIZE;
      }

      return out;
    }

    // Fetch SVA record
    const { data: svaData, error: svaError } = await supabase
      .from("sovereign_ids")
      .select("*")
      .eq("sva_id", sva_id)
      .maybeSingle();

    if (svaError || !svaData) {
      return new Response(
        JSON.stringify({ error: "Sovereign ID not found", sva_id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let zipsInScope = null;
    if (includeZips) {
      zipsInScope = await fetchAllRowsOrdered<{ zip: string; distance_miles: number; population: number | null }>({
        table: "sovereign_id_zips",
        select: "zip, distance_miles, population",
        orderBy: "distance_miles",
        ascending: true,
        eq: { column: "sva_id", value: sva_id },
      });
    }

    let countiesInScope = null;
    if (includeCounties) {
      countiesInScope = await fetchAllRowsOrdered<{
        county_name: string;
        county_fips: string;
        state_id: string;
        min_distance_miles: number;
        zip_count: number;
        total_population: number | null;
      }>({
        table: "sovereign_id_counties",
        select: "county_name, county_fips, state_id, min_distance_miles, zip_count, total_population",
        orderBy: "min_distance_miles",
        ascending: true,
        eq: { column: "sva_id", value: sva_id },
      });
    }

    // Sub-hub status (all locked initially for new SVAs)
    const subHubStatus = [
      { id: 0, name: "Radar / Signals", status: "LOCKED" },
      { id: 1, name: "Competitive Supply", status: "LOCKED" },
      { id: 2, name: "County / FIPS Card", status: "LOCKED" },
      { id: 3, name: "Economics & Calculators", status: "LOCKED" },
      { id: 4, name: "Parcel Discovery", status: "LOCKED" },
      { id: 5, name: "Verdict / Doctrine Gate", status: "LOCKED" },
    ];

    return new Response(
      JSON.stringify({
        ...svaData,
        zips_in_scope: zipsInScope,
        counties_in_scope: countiesInScope,
        sub_hub_status: subHubStatus
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SVA get error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
