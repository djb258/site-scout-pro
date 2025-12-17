import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEventRequest {
  process_id: string;
  action: "scan_started" | "scan_completed" | "scan_aborted" | "scan_failed" | "candidate_promoted" | "candidate_discarded";
  status: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LogEventRequest = await req.json();

    if (!body.process_id || !body.action || !body.status) {
      return new Response(
        JSON.stringify({ error: "process_id, action, and status are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HUB0_LOG_EVENT] Logging event - Process: ${body.process_id}, Action: ${body.action}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase.from('hub0_event_log').insert({
      process_id: body.process_id,
      action: body.action,
      status: body.status,
      error: body.error || null,
      metadata: body.metadata || {}
    }).select().single();

    if (error) {
      console.error(`[HUB0_LOG_EVENT] Insert failed:`, error);
      throw error;
    }

    console.log(`[HUB0_LOG_EVENT] Event logged successfully - ID: ${data.id}`);

    return new Response(
      JSON.stringify({
        logged: true,
        event_id: data.id,
        timestamp: data.created_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[HUB0_LOG_EVENT] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
