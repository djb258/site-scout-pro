import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AnchorBadge } from "@/components/AnchorBadge";
import { SubHubCard } from "@/components/SubHubCard";
import { subHubs } from "@/config/discover-page-config";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Info, 
  Users, 
  Building2,
  TrendingUp,
  RefreshCw,
  Target,
  Layers
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MarketStats {
  total_runs: number;
  completed_runs: number;
  total_demand_agg: number;
  total_supply_agg: number;
  avg_population: number;
  avg_facility_count: number;
  last_run_at: string | null;
}

interface RecentRun {
  id: string;
  step: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

/**
 * Sub-Hub 1 — Market Reality
 * Read-only observation panel for demand & saturation facts
 * Anchor: ZIP
 */
export default function SubHub1Page() {
  const config = subHubs[1];
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch run logs
      const { data: runs, count: totalRuns } = await supabase
        .from('hub1_pass1_run_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch demand aggregates
      const { count: demandCount } = await supabase
        .from('pass1_demand_agg')
        .select('id', { count: 'exact', head: true });

      // Fetch supply aggregates
      const { data: supplyData, count: supplyCount } = await supabase
        .from('pass1_supply_agg')
        .select('facility_count');

      // Calculate averages
      const avgFacility = supplyData?.length 
        ? supplyData.reduce((acc, s) => acc + (s.facility_count || 0), 0) / supplyData.length 
        : 0;

      const completedRuns = runs?.filter(r => r.status === 'completed').length || 0;

      setStats({
        total_runs: totalRuns || 0,
        completed_runs: completedRuns,
        total_demand_agg: demandCount || 0,
        total_supply_agg: supplyCount || 0,
        avg_population: 0, // Would need census data
        avg_facility_count: Math.round(avgFacility),
        last_run_at: runs?.[0]?.created_at || null,
      });

      setRecentRuns((runs || []).slice(0, 5) as RecentRun[]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('[SubHub1] Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const completionRate = stats?.total_runs 
    ? Math.round((stats.completed_runs / stats.total_runs) * 100) 
    : 0;

  return (
    <div className="flex-1 bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <BarChart3 className={`h-6 w-6 ${config.color}`} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground font-mono">
                  Sub-Hub {config.id} — {config.title}
                </h1>
                <p className="text-muted-foreground">{config.purpose}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config.anchors.map(anchor => (
                <AnchorBadge key={anchor} anchor={anchor} size="lg" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Read-Only Notice */}
        <Alert className="bg-muted/50 border-border">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-muted-foreground">
            <span className="font-medium">Read-only observation</span> — This panel displays market reality data. 
            ZIP-level demand & saturation facts only.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Stats & Activity */}
          <div className="col-span-8 space-y-6">
            {/* Market Stats Grid */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Market Analysis Status
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-muted-foreground">Demand Aggregates</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats?.total_demand_agg || 0}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-blue-400" />
                        <span className="text-xs text-muted-foreground">Supply Snapshots</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats?.total_supply_agg || 0}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="h-4 w-4 text-amber-400" />
                        <span className="text-xs text-muted-foreground">Avg Facilities/Area</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats?.avg_facility_count || 0}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Run Completion */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Pipeline Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Run Completion Rate</span>
                  <span className="text-sm font-medium">{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-400">{stats?.completed_runs || 0}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{stats?.total_runs || 0}</div>
                    <div className="text-xs text-muted-foreground">Total Runs</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Run Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Pipeline Runs</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : recentRuns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No runs recorded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentRuns.map(run => (
                      <div 
                        key={run.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            run.status === 'completed' ? 'bg-emerald-400' :
                            run.status === 'running' ? 'bg-blue-400' :
                            run.status === 'failed' ? 'bg-red-400' : 'bg-muted-foreground'
                          }`} />
                          <div>
                            <div className="text-sm font-medium font-mono">{run.step}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            run.status === 'completed' 
                              ? 'border-emerald-500/50 text-emerald-400'
                              : run.status === 'failed'
                              ? 'border-red-500/50 text-red-400'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Sub-Hub Contract */}
          <div className="col-span-4">
            <SubHubCard config={config} showMiniDiagram={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
