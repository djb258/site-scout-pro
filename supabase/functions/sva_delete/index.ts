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

    const { sva_id } = await req.json();

    if (!sva_id) {
      return new Response(
        JSON.stringify({ error: "sva_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if SVA exists
    const { data: existingSva, error: checkError } = await supabase
      .from("sovereign_ids")
      .select("sva_id")
      .eq("sva_id", sva_id)
      .single();

    if (checkError || !existingSva) {
      return new Response(
        JSON.stringify({ error: "Sovereign ID not found", sva_id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete related records first (ZIPs)
    const { error: deleteZipsError } = await supabase
      .from("sovereign_id_zips")
      .delete()
      .eq("sva_id", sva_id);

    if (deleteZipsError) {
      console.error(`Failed to delete ZIPs: ${deleteZipsError.message}`);
    }

    // Delete related records (Counties)
    const { error: deleteCountiesError } = await supabase
      .from("sovereign_id_counties")
      .delete()
      .eq("sva_id", sva_id);

    if (deleteCountiesError) {
      console.error(`Failed to delete counties: ${deleteCountiesError.message}`);
    }

    // Delete the SVA record
    const { error: deleteSvaError } = await supabase
      .from("sovereign_ids")
      .delete()
      .eq("sva_id", sva_id);

    if (deleteSvaError) {
      throw new Error(`Failed to delete SVA: ${deleteSvaError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sovereign ID deleted successfully",
        sva_id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SVA delete error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
