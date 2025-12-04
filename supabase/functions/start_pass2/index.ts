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

    const { pass1_id } = await req.json();

    if (!pass1_id) {
      return new Response(
        JSON.stringify({ error: 'pass1_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[start_pass2] Creating Pass 2 run for pass1_id: ${pass1_id}`);

    // Verify pass1_runs exists and is complete
    const { data: pass1Run, error: fetchError } = await supabase
      .from('pass1_runs')
      .select('*')
      .eq('id', pass1_id)
      .single();

    if (fetchError || !pass1Run) {
      console.error('[start_pass2] Pass 1 not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Pass 1 run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pass2_runs record
    const { data: pass2Run, error: insertError } = await supabase
      .from('pass2_runs')
      .insert({
        pass1_id,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[start_pass2] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[start_pass2] Created pass2_runs record: ${pass2Run.id}`);

    // Log engine event
    await supabase.from('engine_logs').insert({
      engine: 'start_pass2',
      event: 'run_created',
      payload: { pass2_id: pass2Run.id, pass1_id, zip: pass1Run.zip },
      status: 'queued'
    });

    // TODO: Invoke external orchestrator webhook here
    // const orchestratorUrl = Deno.env.get('ORCHESTRATOR_WEBHOOK_URL');
    // if (orchestratorUrl) {
    //   await fetch(orchestratorUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ pass2_id: pass2Run.id, pass1_id, pass1_data: pass1Run })
    //   });
    // }

    return new Response(
      JSON.stringify({ 
        pass2_id: pass2Run.id, 
        status: 'queued' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start_pass2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
