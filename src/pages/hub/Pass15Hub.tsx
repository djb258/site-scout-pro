/**
 * PROCESS: hub15.dashboard
 * VERSION: v0.1.0 (SHELL ONLY)
 * 
 * PURPOSE: Read-only dashboard for Hub 1.5 Remediation Worker.
 * Displays queue status across 4 lanes: Pending / In Progress / Resolved / Failed
 * 
 * NO CONTROLS — pure observability
 * NO SCORING, RANKING, OR RECOMMENDATIONS
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ClipboardCheck, 
  Clock, 
  Play, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Phone,
  Globe,
  DollarSign,
  Activity,
  Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ================================================================
// TYPES — Mirror edge function contracts
// ================================================================
interface QueueSummary {
  pending: number;
  in_progress: number;
  resolved: number;
  failed: number;
  killed: number;
  total: number;
}

interface CostSummary {
  total_cents: number;
  scraper_cents: number;
  ai_caller_cents: number;
}

interface Performance {
  success_rate: number;
  avg_duration_ms: number;
  total_attempts: number;
}

interface GuardRailStatus {
  cost_cap_remaining_cents: number;
  daily_calls_remaining: number;
  failure_rate: number;
  kill_switch_active: boolean;
}

interface AttemptLogEntry {
  id: string;
  gap_queue_id: string;
  worker_type: string;
  attempt_number: number;
  status: string;
  duration_ms?: number;
  cost_cents?: number;
  error_code?: string;
  created_at: string;
}

interface DashboardData {
  queue_summary: QueueSummary;
  cost_summary: CostSummary;
  performance: Performance;
  guard_rail_status: GuardRailStatus;
  recent_attempts?: AttemptLogEntry[];
}

// ================================================================
// GUARD RAIL THRESHOLDS (display only)
// ================================================================
const GUARD_RAILS = {
  COST_CAP_CENTS: 5000,
  DAILY_CALL_LIMIT: 500,
  FAILURE_RATE_THRESHOLD: 0.70,
};

const Pass15Hub = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('hub15_get_dashboard', {
        body: { include_attempts: true, limit: 20 }
      });

      if (fnError) throw fnError;

      setDashboardData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('[hub15.dashboard] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
                <ClipboardCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Pass 1.5 — Remediation Worker</h1>
                <p className="text-muted-foreground">Rate verification and evidence cleanup</p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Version: v0.1.0 (SHELL)</p>
              {lastUpdated && (
                <p>Last updated: {lastUpdated.toLocaleTimeString()}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Guard Rail Status Banner */}
        <Card className={dashboardData?.guard_rail_status.kill_switch_active ? "border-destructive bg-destructive/10" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Guard Rail Status
              </CardTitle>
              {dashboardData?.guard_rail_status.kill_switch_active && (
                <Badge variant="destructive" className="animate-pulse">
                  KILL SWITCH ACTIVE
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cost Cap</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(dashboardData?.guard_rail_status.cost_cap_remaining_cents ?? GUARD_RAILS.COST_CAP_CENTS)}
                  <span className="text-sm text-muted-foreground"> / {formatCurrency(GUARD_RAILS.COST_CAP_CENTS)}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Calls</p>
                <p className="text-lg font-semibold">
                  {dashboardData?.guard_rail_status.daily_calls_remaining ?? GUARD_RAILS.DAILY_CALL_LIMIT}
                  <span className="text-sm text-muted-foreground"> / {GUARD_RAILS.DAILY_CALL_LIMIT}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failure Rate</p>
                <p className={`text-lg font-semibold ${(dashboardData?.guard_rail_status.failure_rate ?? 0) > GUARD_RAILS.FAILURE_RATE_THRESHOLD ? 'text-destructive' : ''}`}>
                  {formatPercent(dashboardData?.guard_rail_status.failure_rate ?? 0)}
                  <span className="text-sm text-muted-foreground"> / {formatPercent(GUARD_RAILS.FAILURE_RATE_THRESHOLD)} max</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatPercent(dashboardData?.performance.success_rate ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4-Lane Queue Status */}
        <div className="grid grid-cols-4 gap-4">
          {/* Pending Lane */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pending
              </CardTitle>
              <CardDescription>Queued for remediation</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-yellow-500">
                {dashboardData?.queue_summary.pending ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                gaps awaiting worker assignment
              </p>
            </CardContent>
          </Card>

          {/* In Progress Lane */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="h-4 w-4 text-blue-500" />
                In Progress
              </CardTitle>
              <CardDescription>Active workers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-500">
                {dashboardData?.queue_summary.in_progress ?? 0}
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span>Scraper: —</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>AI Caller: —</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resolved Lane */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Resolved
              </CardTitle>
              <CardDescription>Successfully remediated</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-500">
                {dashboardData?.queue_summary.resolved ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                queued for Neon vault
              </p>
            </CardContent>
          </Card>

          {/* Failed Lane */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <XCircle className="h-4 w-4 text-destructive" />
                Failed
              </CardTitle>
              <CardDescription>Max attempts exhausted</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-destructive">
                {dashboardData?.queue_summary.failed ?? 0}
              </p>
              {(dashboardData?.queue_summary.killed ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  + {dashboardData?.queue_summary.killed} killed
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview */}
        {dashboardData?.queue_summary.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress 
                value={((dashboardData.queue_summary.resolved + dashboardData.queue_summary.failed) / dashboardData.queue_summary.total) * 100} 
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {dashboardData.queue_summary.resolved + dashboardData.queue_summary.failed} of {dashboardData.queue_summary.total} processed
                </span>
                <span>
                  {formatPercent((dashboardData.queue_summary.resolved + dashboardData.queue_summary.failed) / dashboardData.queue_summary.total)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(dashboardData?.cost_summary.total_cents ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Scraper
                </p>
                <p className="text-xl font-semibold">
                  {formatCurrency(dashboardData?.cost_summary.scraper_cents ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> AI Caller
                </p>
                <p className="text-xl font-semibold">
                  {formatCurrency(dashboardData?.cost_summary.ai_caller_cents ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Attempts Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attempts</CardTitle>
            <CardDescription>Last 20 worker attempts (auto-refresh every 10s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !dashboardData ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : error ? (
              <div className="flex items-center gap-2 text-destructive py-4">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : dashboardData?.recent_attempts?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No attempts logged yet. Shell only — workers not yet implemented.
              </p>
            ) : (
              <div className="space-y-2">
                {dashboardData?.recent_attempts?.map((attempt) => (
                  <div 
                    key={attempt.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {attempt.worker_type === 'scraper' ? (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-mono text-sm">{attempt.gap_queue_id.slice(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">
                          Attempt #{attempt.attempt_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={
                        attempt.status === 'completed' ? 'default' :
                        attempt.status === 'failed' ? 'destructive' :
                        attempt.status === 'started' ? 'secondary' : 'outline'
                      }>
                        {attempt.status}
                      </Badge>
                      {attempt.duration_ms && (
                        <span className="text-sm text-muted-foreground">
                          {(attempt.duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      {attempt.cost_cents !== undefined && attempt.cost_cents > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(attempt.cost_cents)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shell Notice */}
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Badge variant="outline" className="mb-2">SHELL ONLY — v0.1.0</Badge>
            <p className="text-muted-foreground">
              Workers not yet implemented. TODO: Wire Retell.ai and Firecrawl integrations.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Pass15Hub;
