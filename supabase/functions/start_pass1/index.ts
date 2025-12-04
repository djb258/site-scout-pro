import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      zip, 
      urban_exclude = false, 
      multifamily_priority = false, 
      recreation_load = false, 
      industrial_momentum = false,
      analysis_mode = 'build'
    } = await req.json();

    if (!zip) {
      return new Response(
        JSON.stringify({ error: 'ZIP code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass1] Creating run for ZIP: ${zip}`);

    // Create pass1_runs record
    const toggles = {
      urban_exclude,
      multifamily_priority,
      recreation_load,
      industrial_momentum,
      analysis_mode
    };

    const { data: pass1Run, error: insertError } = await supabase
      .from('pass1_runs')
      .insert({
        zip,
        toggles,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass1] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[start_pass1] Created pass1_runs record: ${pass1Run.id}`);

    // Log engine event
    await supabase.from('engine_logs').insert({
      engine: 'start_pass1',
      event: 'run_created',
      payload: { pass1_id: pass1Run.id, zip, toggles },
      status: 'queued'
    });

    // TODO: Invoke external orchestrator webhook here
    // const orchestratorUrl = Deno.env.get('ORCHESTRATOR_WEBHOOK_URL');
    // if (orchestratorUrl) {
    //   await fetch(orchestratorUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ pass1_id: pass1Run.id, zip, toggles })
    //   });
    // }

    return new Response(
      JSON.stringify({ 
        pass1_id: pass1Run.id, 
        status: 'queued' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass1] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
