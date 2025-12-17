import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS
// ============================================================================
const SCHEMA_VERSION = "v1.0";
const PROCESS_ID = "hub1.pass1";
const SCORING_WEIGHTS = {
  demand: 0.40,
  supply: 0.35,
  constraints: 0.25
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================
interface LogEventRequest {
  run_id: string;
  step?: string;
  status?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  error_code?: string;
  error_message?: string;
  fatal?: boolean;
  competition_confidence?: "low" | "medium";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: LogEventRequest = await req.json();
    const { 
      run_id, 
      step, 
      status, 
      action,
      metadata = {}, 
      error_code, 
      error_message, 
      fatal = false,
      competition_confidence 
    } = body;

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[HUB1_LOG] Logging event for run ${run_id}: ${action || step}`);

    // If error_code is present, log to error table
    if (error_code) {
      const { error } = await supabase.from('hub1_pass1_error_log').insert({
        run_id,
        process_id: PROCESS_ID,
        step: step || action || 'unknown',
        error_code,
        error_message: error_message || 'No message provided',
        fatal,
        recoverable: !fatal,
        metadata
      });

      if (error) {
        console.error('[HUB1_LOG] Error logging to error_log:', error);
        throw error;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        type: 'error_log',
        run_id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Otherwise log to run log
    const { error } = await supabase.from('hub1_pass1_run_log').insert({
      run_id,
      process_id: PROCESS_ID,
      step: step || action || 'event',
      status: status || 'logged',
      schema_version: SCHEMA_VERSION,
      scoring_weights: SCORING_WEIGHTS,
      competition_confidence: competition_confidence || null,
      metadata
    });

    if (error) {
      console.error('[HUB1_LOG] Error logging to run_log:', error);
      throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      type: 'run_log',
      run_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[HUB1_LOG] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      error: errorMessage,
      process_id: PROCESS_ID
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
