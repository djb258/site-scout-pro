import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromoteRequest {
  candidate: {
    city: string;
    county: string;
    state: string;
    signal_score: number;
    rationale: string;
    sources: { title: string; type: string; snippet: string; date: string }[];
  };
  process_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PromoteRequest = await req.json();

    if (!body.candidate || !body.process_id) {
      return new Response(
        JSON.stringify({ error: "candidate and process_id are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HUB0_PROMOTE] Promoting candidate - Process ID: ${body.process_id}`);
    console.log(`[HUB0_PROMOTE] Area: ${body.candidate.city}, ${body.candidate.county}, ${body.candidate.state}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate the structured handoff payload
    const handoffPayload = {
      hub: "hub0",
      promoted_to: "hub1",
      area: {
        city: body.candidate.city,
        county: body.candidate.county,
        state: body.candidate.state
      },
      rationale: body.candidate.rationale,
      signal_score: body.candidate.signal_score,
      sources: body.candidate.sources,
      generated_at: new Date().toISOString(),
      process_id: body.process_id
    };

    // Log the promotion event
    const { error } = await supabase.from('hub0_event_log').insert({
      process_id: body.process_id,
      action: 'candidate_promoted',
      status: 'completed',
      metadata: {
        promoted_area: handoffPayload.area,
        signal_score: handoffPayload.signal_score,
        generated_at: handoffPayload.generated_at
      }
    });

    if (error) {
      console.error(`[HUB0_PROMOTE] Failed to log promotion:`, error);
      // Continue anyway - the promotion payload is what matters
    }

    console.log(`[HUB0_PROMOTE] Handoff payload generated successfully`);

    // Return the handoff payload (this is what Hub 1 will consume)
    return new Response(
      JSON.stringify(handoffPayload),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[HUB0_PROMOTE] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
