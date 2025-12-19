import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StageStatus {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'killed' | 'error';
  last_run: string | null;
  item_count: number;
  error_count: number;
  kill_switch: boolean;
}

interface Pass0Status {
  last_run: string | null;
  throttle_state: 'normal' | 'throttled' | 'paused';
  kill_switch_active: boolean;
  audit_log_count: number;
  queue_depth: number;
  stages: StageStatus[];
  recent_events: Array<{
    action: string;
    status: string;
    timestamp: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[hub0_get_status] Fetching Pass 0 status (read-only)');

    // Fetch latest run log entries per stage
    const { data: runLogs, error: runLogsError } = await supabase
      .from('pass0_run_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (runLogsError) {
      console.error('[hub0_get_status] Error fetching run logs:', runLogsError);
    }

    // Fetch audit log count from hub0_event_log
    const { count: auditLogCount, error: auditError } = await supabase
      .from('hub0_event_log')
      .select('*', { count: 'exact', head: true });

    if (auditError) {
      console.error('[hub0_get_status] Error fetching audit count:', auditError);
    }

    // Fetch recent events
    const { data: recentEvents, error: eventsError } = await supabase
      .from('hub0_event_log')
      .select('action, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error('[hub0_get_status] Error fetching events:', eventsError);
    }

    // Fetch pending queue depth
    const { count: queueDepth, error: queueError } = await supabase
      .from('pass0_url_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (queueError) {
      console.error('[hub0_get_status] Error fetching queue:', queueError);
    }

    // Build stage statuses from run logs
    const stageIds = ['news_narratives', 'permits_inspections', 'geo_pin_output'];
    const stageLabels: Record<string, string> = {
      'news_narratives': 'Stage 1: News & Narratives',
      'permits_inspections': 'Stage 2: Permits & Inspections',
      'geo_pin_output': 'Stage 3: Geo Resolution & Pin Output'
    };

    const stages: StageStatus[] = stageIds.map(stageId => {
      // Find most recent log for this stage
      const stageLogs = (runLogs || []).filter(log => log.step === stageId);
      const latestLog = stageLogs[0];

      // Calculate totals from all logs for this stage
      const totalItems = stageLogs.reduce((sum, log) => sum + (log.item_count || 0), 0);
      const totalErrors = stageLogs.reduce((sum, log) => sum + (log.failure_count || 0), 0);

      // Determine status
      let status: 'idle' | 'running' | 'killed' | 'error' = 'idle';
      const killSwitch = latestLog?.kill_switch ?? false;
      
      if (killSwitch) {
        status = 'killed';
      } else if (latestLog?.status === 'running') {
        status = 'running';
      } else if (totalErrors > 0) {
        status = 'error';
      }

      return {
        id: stageId,
        label: stageLabels[stageId],
        status,
        last_run: latestLog?.ended_at || latestLog?.started_at || null,
        item_count: totalItems,
        error_count: totalErrors,
        kill_switch: killSwitch
      };
    });

    // Determine global kill switch state
    const killSwitchActive = stages.some(s => s.kill_switch);

    // Find most recent run across all stages
    const runLogsArray = runLogs || [];
    const lastRun = runLogsArray.length > 0 
      ? runLogsArray[0].ended_at || runLogsArray[0].started_at 
      : null;

    // Determine throttle state based on recent activity
    const recentRunCount = (runLogs || []).filter(log => {
      const logTime = new Date(log.created_at).getTime();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return logTime > fiveMinutesAgo;
    }).length;

    let throttleState: 'normal' | 'throttled' | 'paused' = 'normal';
    if (killSwitchActive) {
      throttleState = 'paused';
    } else if (recentRunCount > 10) {
      throttleState = 'throttled';
    }

    const response: Pass0Status = {
      last_run: lastRun,
      throttle_state: throttleState,
      kill_switch_active: killSwitchActive,
      audit_log_count: auditLogCount || 0,
      queue_depth: queueDepth || 0,
      stages,
      recent_events: (recentEvents || []).map(e => ({
        action: e.action,
        status: e.status,
        timestamp: e.created_at
      }))
    };

    console.log('[hub0_get_status] Status retrieved successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[hub0_get_status] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
