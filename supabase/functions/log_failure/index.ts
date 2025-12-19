import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LOG_FAILURE Edge Function
 * 
 * Centralized error logging to master_failure_log table.
 * All passes must log errors here for audit trail.
 * 
 * process_id: log_failure
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogFailureInput {
  process_id: string;
  pass_number: number;
  run_id?: string;
  step: string;
  error_code: string;
  error_message?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, unknown>;
}

interface LogFailureOutput {
  success: boolean;
  failure_id?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: LogFailureInput = await req.json();
    const { 
      process_id, 
      pass_number, 
      run_id, 
      step, 
      error_code, 
      error_message, 
      severity = 'error',
      context = {} 
    } = input;

    // Validation
    if (!process_id || pass_number === undefined || !step || !error_code) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: process_id, pass_number, step, error_code'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate pass_number
    if (![0, 1, 15, 2, 3].includes(pass_number)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid pass_number: ${pass_number}. Must be 0, 1, 15, 2, or 3`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate severity
    const validSeverities = ['info', 'warning', 'error', 'critical'];
    if (!validSeverities.includes(severity)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid severity: ${severity}. Must be info, warning, error, or critical`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Init Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert into master_failure_log
    const { data, error } = await supabase
      .from('master_failure_log')
      .insert({
        process_id,
        pass_number,
        run_id: run_id || null,
        step,
        error_code,
        error_message: error_message || null,
        severity,
        context,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[LOG_FAILURE] Insert error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[LOG_FAILURE] Logged failure ${data.id} for pass ${pass_number}: ${error_code}`);

    const response: LogFailureOutput = {
      success: true,
      failure_id: data.id,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[LOG_FAILURE] Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
