import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { process_id } = await req.json();

    if (!process_id) {
      return new Response(
        JSON.stringify({ error: "process_id is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HUB0_ABORT_SCAN] Aborting scan - Process ID: ${process_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the abort event immediately
    const { error } = await supabase.from('hub0_event_log').insert({
      process_id,
      action: 'scan_aborted',
      status: 'aborted',
      metadata: { aborted_at: new Date().toISOString() }
    });

    if (error) {
      console.error(`[HUB0_ABORT_SCAN] Failed to log abort:`, error);
      throw error;
    }

    console.log(`[HUB0_ABORT_SCAN] Scan aborted successfully`);

    return new Response(
      JSON.stringify({
        aborted: true,
        process_id,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[HUB0_ABORT_SCAN] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
