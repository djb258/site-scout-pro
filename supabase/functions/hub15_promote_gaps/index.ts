/**
 * PROCESS: hub15.promote_gaps
 * VERSION: v1.0.0
 * 
 * PURPOSE: Scan competitor_facilities for incomplete data and promote to Pass 1.5 queue.
 * Calculates data_completeness score and flags records needing verification.
 * 
 * INPUT: run_id, pass1_run_id (optional filters)
 * OUTPUT: Count of promoted gaps, updated competitor_facilities records
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromoteGapsInput {
  run_id: string;
  pass1_run_id?: string;
  zip_code?: string;
  county?: string;
  force_rescan?: boolean;
}

// Fields that determine data completeness
const CRITICAL_FIELDS = ['rent_10x10', 'rent_10x20', 'total_sqft', 'price_per_sqft'];
const OPTIONAL_FIELDS = ['rent_5x5', 'rent_5x10', 'rent_10x15', 'rent_10x30', 'phone', 'website_url'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processId = 'hub15.promote_gaps';
  const version = 'v1.0.0';

  try {
    const input: PromoteGapsInput = await req.json();
    const { run_id, pass1_run_id, zip_code, county, force_rescan = false } = input;

    if (!run_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'run_id is required',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${processId}@${version}] Scanning for incomplete competitors, run_id=${run_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query for competitors
    let query = supabase
      .from('competitor_facilities')
      .select('*');

    // Apply filters
    if (zip_code) {
      query = query.eq('zip_code', zip_code);
    }
    if (county) {
      query = query.eq('county', county);
    }
    if (!force_rescan) {
      // Only scan records not already promoted
      query = query.eq('promoted_to_pass15', false);
    }

    const { data: competitors, error: fetchError } = await query;

    if (fetchError) {
      console.error(`[${processId}] Error fetching competitors:`, fetchError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch competitors',
        details: fetchError.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${processId}] Found ${competitors?.length || 0} competitors to analyze`);

    const promotedGaps: Array<{
      competitor_id: string;
      competitor_name: string;
      gap_type: string;
      missing_fields: string[];
      data_completeness: number;
    }> = [];

    const gapQueueInserts: Array<{
      run_id: string;
      pass1_run_id: string;
      competitor_id: string;
      competitor_name: string;
      competitor_address: string | null;
      phone_number: string | null;
      gap_type: string;
      target_unit_sizes: string[];
      priority: string;
      status: string;
    }> = [];

    for (const competitor of competitors || []) {
      // Calculate missing fields
      const missingCritical: string[] = [];
      const missingOptional: string[] = [];

      for (const field of CRITICAL_FIELDS) {
        if (competitor[field] === null || competitor[field] === undefined) {
          missingCritical.push(field);
        }
      }

      for (const field of OPTIONAL_FIELDS) {
        if (competitor[field] === null || competitor[field] === undefined) {
          missingOptional.push(field);
        }
      }

      // Calculate data completeness score (0-100)
      const criticalScore = ((CRITICAL_FIELDS.length - missingCritical.length) / CRITICAL_FIELDS.length) * 70;
      const optionalScore = ((OPTIONAL_FIELDS.length - missingOptional.length) / OPTIONAL_FIELDS.length) * 30;
      const dataCompleteness = Math.round(criticalScore + optionalScore);

      // Determine gap type
      let gapType = 'complete';
      let priority = 'low';

      if (missingCritical.length > 0) {
        if (missingCritical.includes('rent_10x10') || missingCritical.includes('rent_10x20')) {
          gapType = 'missing_rents';
          priority = 'high';
        } else if (missingCritical.includes('price_per_sqft') || missingCritical.includes('total_sqft')) {
          gapType = 'missing_size_data';
          priority = 'normal';
        }
      } else if (missingOptional.length > 2) {
        gapType = 'incomplete_details';
        priority = 'low';
      }

      // Update competitor record
      const updatePayload: Record<string, unknown> = {
        data_completeness: dataCompleteness,
        missing_fields: [...missingCritical, ...missingOptional],
        updated_at: new Date().toISOString(),
      };

      // Only promote if data is incomplete (< 80%) or missing critical fields
      if (dataCompleteness < 80 || missingCritical.length > 0) {
        updatePayload.needs_call_verification = true;
        updatePayload.promoted_to_pass15 = true;

        // Determine target unit sizes to ask about
        const targetUnits: string[] = [];
        if (missingCritical.includes('rent_10x10') || !competitor.rent_10x10) targetUnits.push('10x10');
        if (missingCritical.includes('rent_10x20') || !competitor.rent_10x20) targetUnits.push('10x20');
        if (!competitor.rent_10x15) targetUnits.push('10x15');
        if (!competitor.rent_5x10) targetUnits.push('5x10');

        promotedGaps.push({
          competitor_id: competitor.id,
          competitor_name: competitor.facility_name,
          gap_type: gapType,
          missing_fields: [...missingCritical, ...missingOptional],
          data_completeness: dataCompleteness,
        });

        // Prepare gap queue insert
        gapQueueInserts.push({
          run_id,
          pass1_run_id: pass1_run_id || run_id,
          competitor_id: competitor.id,
          competitor_name: competitor.facility_name,
          competitor_address: competitor.address,
          phone_number: competitor.phone,
          gap_type: gapType,
          target_unit_sizes: targetUnits.length > 0 ? targetUnits : ['10x10', '10x20'],
          priority,
          status: 'pending',
        });
      }

      // Update the competitor record
      await supabase
        .from('competitor_facilities')
        .update(updatePayload)
        .eq('id', competitor.id);
    }

    // Batch insert gap queue entries
    if (gapQueueInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('pass_1_5_gap_queue')
        .insert(gapQueueInserts);

      if (insertError) {
        console.error(`[${processId}] Error inserting gap queue entries:`, insertError);
        // Continue - the competitor updates succeeded
      } else {
        // Update competitor records with their queue IDs
        const { data: queueEntries } = await supabase
          .from('pass_1_5_gap_queue')
          .select('id, competitor_id')
          .eq('run_id', run_id);

        if (queueEntries) {
          for (const entry of queueEntries) {
            await supabase
              .from('competitor_facilities')
              .update({ pass15_queue_id: entry.id })
              .eq('id', entry.competitor_id);
          }
        }
      }
    }

    console.log(`[${processId}] Promoted ${promotedGaps.length} gaps to Pass 1.5 queue`);

    return new Response(JSON.stringify({
      success: true,
      process_id: processId,
      version,
      run_id,
      total_scanned: competitors?.length || 0,
      gaps_promoted: promotedGaps.length,
      promoted_gaps: promotedGaps,
      summary: {
        high_priority: promotedGaps.filter(g => 
          gapQueueInserts.find(i => i.competitor_id === g.competitor_id)?.priority === 'high'
        ).length,
        normal_priority: promotedGaps.filter(g => 
          gapQueueInserts.find(i => i.competitor_id === g.competitor_id)?.priority === 'normal'
        ).length,
        low_priority: promotedGaps.filter(g => 
          gapQueueInserts.find(i => i.competitor_id === g.competitor_id)?.priority === 'low'
        ).length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${processId}@${version}] ERROR:`, error);
    return new Response(JSON.stringify({
      success: false,
      process_id: processId,
      version,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
