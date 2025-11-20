import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generic Relay: Received request');
    
    const body = await req.json();
    console.log('Generic Relay: Payload received', { payloadSize: JSON.stringify(body).length });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generic insert into Neon via Supabase
    const { data, error } = await supabase
      .from('generic_ingest_log')
      .insert({
        payload: body,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Generic Relay: Database error', error);
      throw error;
    }

    console.log('Generic Relay: Successfully logged to Neon', { id: data?.id });

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Payload received and logged to Neon.',
        data,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Generic Relay: Error', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        status: 'error',
        message: errorMessage,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
