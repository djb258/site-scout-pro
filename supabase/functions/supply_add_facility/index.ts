import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddFacilityRequest {
  zip_code: string;
  facility_name: string;
  address: string;
  phone?: string;
  website_url?: string;
  facility_id: string;
  source?: string;
  discovery_context?: Record<string, unknown>;
}

// Validate facility_id format: fac_XXXXXXXX (8 hex chars)
function validateFacilityId(facilityId: string): { valid: boolean; error?: string } {
  const formatRegex = /^fac_[a-f0-9]{8}$/;
  if (!formatRegex.test(facilityId)) {
    return { 
      valid: false, 
      error: "Facility ID must match format: fac_XXXXXXXX (fac_ prefix + 8 lowercase hex characters)" 
    };
  }
  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: AddFacilityRequest = await req.json();
    const { 
      zip_code, 
      facility_name, 
      address, 
      phone, 
      website_url, 
      facility_id, 
      source = "manual",
      discovery_context = {}
    } = body;

    // Validation: Required fields
    if (!zip_code || !facility_name || !address || !facility_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "MISSING_REQUIRED_FIELDS",
          message: "zip_code, facility_name, address, and facility_id are required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GATE 1: ZIP Authority - ZIP must exist in sovereign_id_zips
    const { data: zipData, error: zipError } = await supabase
      .from("sovereign_id_zips")
      .select("zip")
      .eq("zip", zip_code)
      .limit(1);

    if (zipError) {
      console.error("ZIP lookup error:", zipError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "ZIP_LOOKUP_ERROR",
          message: "Failed to verify ZIP authorization" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!zipData || zipData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "ZIP_NOT_AUTHORIZED",
          message: `ZIP code ${zip_code} not found in authorized scope (sovereign_id_zips)` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GATE 2: Facility ID Format Validation
    const idValidation = validateFacilityId(facility_id);
    if (!idValidation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "INVALID_FACILITY_ID",
          message: idValidation.error 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: INSERT into facility_raw (append-only audit trail)
    const { data: rawData, error: rawError } = await supabase
      .from("facility_raw")
      .insert({
        zip_code,
        facility_name_raw: facility_name,
        address_raw: address,
        phone_raw: phone,
        website_url_raw: website_url,
        source,
        discovery_context
      })
      .select("raw_id")
      .single();

    if (rawError) {
      console.error("facility_raw insert error:", rawError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "RAW_INSERT_ERROR",
          message: "Failed to insert into facility_raw" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: UPSERT into facility_master (canonical record)
    // Check if facility already exists
    const { data: existingFacility } = await supabase
      .from("facility_master")
      .select("facility_id")
      .eq("facility_id", facility_id)
      .limit(1);

    let masterResult;
    if (existingFacility && existingFacility.length > 0) {
      // Facility exists - do not overwrite, just return existing
      masterResult = { facility_id, existed: true };
    } else {
      // Insert new canonical record
      const { data: masterData, error: masterError } = await supabase
        .from("facility_master")
        .insert({
          facility_id,
          zip_code,
          facility_name,
          address,
          phone,
          website_url,
          status: "active"
        })
        .select("facility_id")
        .single();

      if (masterError) {
        console.error("facility_master insert error:", masterError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "MASTER_INSERT_ERROR",
            message: "Failed to insert into facility_master",
            raw_id: rawData.raw_id // Raw was still recorded
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      masterResult = { facility_id: masterData.facility_id, existed: false };
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        raw_id: rawData.raw_id,
        facility_id: masterResult.facility_id,
        facility_existed: masterResult.existed
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("supply_add_facility error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
