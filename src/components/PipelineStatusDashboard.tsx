/**
 * Pipeline Status Dashboard
 * READ-ONLY pass-by-pass truth exposure
 * 
 * HARD RULES:
 * - No buttons that mutate state
 * - No manual overrides
 * - No retries from UI
 * - Data sources: Supabase staging tables + execution logs (NO Neon reads)
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Circle, 
  Loader2,
  MapPin,
  Users,
  Phone,
  FileCheck,
  Building2,
  Calculator
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type PassStatus = "green" | "yellow" | "red" | "pending";

interface PassInfo {
  pass: string;
  label: string;
  status: PassStatus;
  signal: string;
  reason?: string;
  icon: React.ReactNode;
}

interface PipelineStatusDashboardProps {
  zipRunId?: string;
  countyId?: number;
  zip?: string;
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

function getStatusIcon(status: PassStatus) {
  switch (status) {
    case "green":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "yellow":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "red":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "pending":
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

function getStatusBadgeVariant(status: PassStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "green":
      return "default";
    case "yellow":
      return "secondary";
    case "red":
      return "destructive";
    case "pending":
      return "outline";
  }
}

function getStatusLabel(status: PassStatus): string {
  switch (status) {
    case "green":
      return "Complete";
    case "yellow":
      return "Degraded";
    case "red":
      return "Failed";
    case "pending":
      return "Pending";
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PipelineStatusDashboard({ 
  zipRunId, 
  countyId,
  zip 
}: PipelineStatusDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [passes, setPasses] = useState<PassInfo[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchPipelineStatus = useCallback(async () => {
    setIsLoading(true);
    
    const passInfos: PassInfo[] = [];
    
    try {
      // =====================================================================
      // PASS 1: Check radius zips, demand bands from staging tables
      // =====================================================================
      let pass1Status: PassStatus = "pending";
      let pass1Signal = "Not started";
      let pass1Reason: string | undefined;

      if (zipRunId) {
        // Check for radius zips
        const { data: radiusData, error: radiusError } = await supabase
          .from('pass1_radius_zip')
          .select('id', { count: 'exact', head: true })
          .eq('run_id', zipRunId);
        
        // Check for demand aggregates
        const { data: demandData, error: demandError } = await supabase
          .from('pass1_demand_agg')
          .select('id', { count: 'exact', head: true })
          .eq('run_id', zipRunId);

        const radiusCount = radiusData ? 1 : 0; // count check
        const demandCount = demandData ? 1 : 0;

        if (radiusError || demandError) {
          pass1Status = "red";
          pass1Signal = "Query failed";
          pass1Reason = radiusError?.message || demandError?.message;
        } else if (radiusCount > 0 && demandCount > 0) {
          pass1Status = "green";
          pass1Signal = "Radius + Demand populated";
        } else if (radiusCount > 0 || demandCount > 0) {
          pass1Status = "yellow";
          pass1Signal = "Partial data";
          pass1Reason = `Radius: ${radiusCount > 0 ? '✓' : '✗'}, Demand: ${demandCount > 0 ? '✓' : '✗'}`;
        } else {
          pass1Status = "pending";
          pass1Signal = "No data yet";
        }
      }

      passInfos.push({
        pass: "1",
        label: "Pass 1",
        status: pass1Status,
        signal: pass1Signal,
        reason: pass1Reason,
        icon: <MapPin className="h-4 w-4" />
      });

      // =====================================================================
      // PASS 1.5: Check AI caller attempts - success/degraded/failed
      // =====================================================================
      let pass15Status: PassStatus = "pending";
      let pass15Signal = "No attempts";
      let pass15Reason: string | undefined;

      if (zipRunId) {
        const { data: attemptLogs, error: attemptError } = await supabase
          .from('pass_1_5_attempt_log')
          .select('status, error_code, error_message, worker_type')
          .eq('run_id', zipRunId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (attemptError) {
          pass15Status = "red";
          pass15Signal = "Query failed";
          pass15Reason = attemptError.message;
        } else if (attemptLogs && attemptLogs.length > 0) {
          const completed = attemptLogs.filter(a => a.status === 'completed' || a.status === 'success').length;
          const degraded = attemptLogs.filter(a => a.status === 'degraded').length;
          const failed = attemptLogs.filter(a => a.status === 'failed' || a.status === 'timeout').length;

          if (failed > 0 && completed === 0) {
            pass15Status = "red";
            pass15Signal = `${failed} failed, 0 success`;
            const lastFailed = attemptLogs.find(a => a.status === 'failed' || a.status === 'timeout');
            pass15Reason = lastFailed?.error_message || lastFailed?.error_code;
          } else if (degraded > 0 || failed > 0) {
            pass15Status = "yellow";
            pass15Signal = `${completed} success, ${degraded} degraded, ${failed} failed`;
            pass15Reason = "Some AI calls returned incomplete data";
          } else if (completed > 0) {
            pass15Status = "green";
            pass15Signal = `${completed} successful calls`;
          }
        }
      }

      passInfos.push({
        pass: "1.5",
        label: "Pass 1.5",
        status: pass15Status,
        signal: pass15Signal,
        reason: pass15Reason,
        icon: <Phone className="h-4 w-4" />
      });

      // =====================================================================
      // PASS 2: Check verdict from pass2_results
      // =====================================================================
      let pass2Status: PassStatus = "pending";
      let pass2Signal = "Not started";
      let pass2Reason: string | undefined;

      if (zipRunId) {
        const { data: pass2Data, error: pass2Error } = await supabase
          .from('pass2_results')
          .select('verdict, feasibility, zoning')
          .eq('zip_run_id', zipRunId)
          .maybeSingle();

        if (pass2Error) {
          pass2Status = "red";
          pass2Signal = "Query failed";
          pass2Reason = pass2Error.message;
        } else if (pass2Data) {
          const verdict = pass2Data.verdict as Record<string, unknown> | null;
          const feasibility = pass2Data.feasibility as Record<string, unknown> | null;
          
          if (verdict && Object.keys(verdict).length > 0) {
            const decision = (verdict as { decision?: string }).decision || 'unknown';
            const confidence = (verdict as { confidence?: number }).confidence || 0;
            
            if (decision === 'PROCEED' || decision === 'GO') {
              pass2Status = "green";
              pass2Signal = `${decision} (${Math.round(confidence * 100)}%)`;
            } else if (decision === 'HOLD' || decision === 'REVIEW') {
              pass2Status = "yellow";
              pass2Signal = `${decision} (${Math.round(confidence * 100)}%)`;
              pass2Reason = "Requires manual review";
            } else {
              pass2Status = "red";
              pass2Signal = `${decision}`;
              pass2Reason = (verdict as { reason?: string }).reason;
            }
          } else if (feasibility && Object.keys(feasibility).length > 0) {
            pass2Status = "yellow";
            pass2Signal = "Feasibility only (no verdict)";
            pass2Reason = "Missing final verdict calculation";
          } else {
            pass2Status = "pending";
            pass2Signal = "No results yet";
          }
        }
      }

      passInfos.push({
        pass: "2",
        label: "Pass 2",
        status: pass2Status,
        signal: pass2Signal,
        reason: pass2Reason,
        icon: <Users className="h-4 w-4" />
      });

      // =====================================================================
      // JURISDICTION CARD: Check envelope_complete from jurisdiction_card_drafts
      // =====================================================================
      let jcStatus: PassStatus = "pending";
      let jcSignal = "Not collected";
      let jcReason: string | undefined;

      if (countyId) {
        const { data: jcData, error: jcError } = await supabase
          .from('jurisdiction_card_drafts')
          .select('envelope_complete, card_complete, status, failure_reason, fatal_prohibition')
          .eq('county_id', countyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (jcError) {
          jcStatus = "red";
          jcSignal = "Query failed";
          jcReason = jcError.message;
        } else if (jcData) {
          if (jcData.fatal_prohibition && jcData.fatal_prohibition !== 'unknown' && jcData.fatal_prohibition !== 'none') {
            jcStatus = "red";
            jcSignal = "FATAL PROHIBITION";
            jcReason = jcData.fatal_prohibition;
          } else if (jcData.envelope_complete && jcData.card_complete) {
            jcStatus = "green";
            jcSignal = "Envelope complete";
          } else if (jcData.envelope_complete) {
            jcStatus = "yellow";
            jcSignal = "Envelope complete, card incomplete";
            jcReason = "Some fields still unknown";
          } else if (jcData.status === 'failed') {
            jcStatus = "red";
            jcSignal = "Collection failed";
            jcReason = jcData.failure_reason || undefined;
          } else {
            jcStatus = "yellow";
            jcSignal = "Envelope incomplete";
            jcReason = "Pass 3 solver will be blocked";
          }
        }
      }

      passInfos.push({
        pass: "JC",
        label: "Jurisdiction Card",
        status: jcStatus,
        signal: jcSignal,
        reason: jcReason,
        icon: <FileCheck className="h-4 w-4" />
      });

      // =====================================================================
      // PASS 3: Check solver execution from engine_logs
      // =====================================================================
      let pass3Status: PassStatus = "pending";
      let pass3Signal = "Not started";
      let pass3Reason: string | undefined;

      // Check master_failure_log for envelope blocks
      const { data: failureData } = await supabase
        .from('master_failure_log')
        .select('error_code, error_message, created_at')
        .eq('process_id', 'solver_run')
        .eq('pass_number', 3)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (failureData && failureData.error_code === 'ENVELOPE_INCOMPLETE') {
        pass3Status = "red";
        pass3Signal = "BLOCKED";
        pass3Reason = "Envelope incomplete — solver refused to run";
      } else {
        // Check engine_logs for solver runs
        const { data: solverLogs } = await supabase
          .from('engine_logs')
          .select('status, payload, created_at')
          .eq('engine', 'solver_run')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (solverLogs) {
          const payload = solverLogs.payload as Record<string, unknown> | null;
          if (solverLogs.status === 'completed' || solverLogs.status === 'success') {
            pass3Status = "green";
            pass3Signal = "Solver executed";
          } else if (solverLogs.status === 'blocked') {
            pass3Status = "red";
            pass3Signal = "Solver blocked";
            pass3Reason = (payload as { blocked_reason?: string })?.blocked_reason;
          } else {
            pass3Status = "yellow";
            pass3Signal = `Status: ${solverLogs.status}`;
          }
        }
      }

      passInfos.push({
        pass: "3",
        label: "Pass 3",
        status: pass3Status,
        signal: pass3Signal,
        reason: pass3Reason,
        icon: <Calculator className="h-4 w-4" />
      });

      setPasses(passInfos);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('[PipelineStatusDashboard] Error fetching status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [zipRunId, countyId]);

  useEffect(() => {
    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Pipeline Status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Pipeline Status
              {zip && <Badge variant="outline" className="ml-2 font-mono">{zip}</Badge>}
            </CardTitle>
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Horizontal Pipeline */}
          <div className="flex items-center gap-2">
            {passes.map((pass, idx) => (
              <div key={pass.pass} className="flex items-center">
                {idx > 0 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    passes[idx - 1].status === 'green' ? 'bg-emerald-500' :
                    passes[idx - 1].status === 'yellow' ? 'bg-amber-500' :
                    passes[idx - 1].status === 'red' ? 'bg-red-500' :
                    'bg-muted'
                  }`} />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex flex-col items-center p-3 rounded-lg border transition-all cursor-default ${
                      pass.status === 'green' ? 'border-emerald-500/50 bg-emerald-500/5' :
                      pass.status === 'yellow' ? 'border-amber-500/50 bg-amber-500/5' :
                      pass.status === 'red' ? 'border-red-500/50 bg-red-500/5' :
                      'border-border bg-muted/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {pass.icon}
                        <span className="text-sm font-medium">{pass.label}</span>
                      </div>
                      {getStatusIcon(pass.status)}
                      <Badge 
                        variant={getStatusBadgeVariant(pass.status)} 
                        className="mt-2 text-xs"
                      >
                        {getStatusLabel(pass.status)}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">{pass.signal}</p>
                      {pass.reason && (
                        <p className="text-xs text-muted-foreground">{pass.reason}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>

          {/* Status Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Complete</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>Degraded/Incomplete</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>Failed/Blocked</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-muted-foreground" />
              <span>Pending</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
