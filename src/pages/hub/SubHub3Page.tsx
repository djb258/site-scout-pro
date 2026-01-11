import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AnchorBadge } from "@/components/AnchorBadge";
import { SubHubCard } from "@/components/SubHubCard";
import { RefDataPanel } from "@/components/RefDataPanel";
import { subHubs } from "@/config/discover-page-config";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { 
  Calculator, 
  Info, 
  DollarSign,
  TrendingUp,
  Percent,
  RefreshCw,
  Target,
  Scale
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CalculatorStats {
  total_pass2_runs: number;
  with_feasibility: number;
  with_verdict: number;
  avg_viability_score: number;
  last_calculation_at: string | null;
}

interface RecentCalculation {
  id: string;
  status: string;
  feasibility: Record<string, unknown> | null;
  verdict: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Sub-Hub 3 — Calculators
 * Read-only observation panel for SVA-level scores & feasibility
 * Anchor: SVA
 */
export default function SubHub3Page() {
  const config = subHubs[3];
  const [stats, setStats] = useState<CalculatorStats | null>(null);
  const [recentCalcs, setRecentCalcs] = useState<RecentCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch pass2 runs for calculator outputs
      const { data: runs, count: totalRuns } = await supabase
        .from('pass2_runs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      const withFeasibility = runs?.filter(r => r.feasibility && Object.keys(r.feasibility as object).length > 0).length || 0;
      const withVerdict = runs?.filter(r => r.verdict && Object.keys(r.verdict as object).length > 0).length || 0;

      setStats({
        total_pass2_runs: totalRuns || 0,
        with_feasibility: withFeasibility,
        with_verdict: withVerdict,
        avg_viability_score: 0, // Would need to calculate from results
        last_calculation_at: runs?.[0]?.created_at || null,
      });

      setRecentCalcs((runs || []).slice(0, 5).map(r => ({
        id: r.id,
        status: r.status || 'unknown',
        feasibility: r.feasibility as Record<string, unknown> | null,
        verdict: r.verdict as Record<string, unknown> | null,
        created_at: r.created_at,
      })));

      setLastRefresh(new Date());
    } catch (error) {
      console.error('[SubHub3] Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <Calculator className={`h-6 w-6 ${config.color}`} />
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
            <span className="font-medium">Read-only observation</span> — This panel displays calculator outputs. 
            Reads ZIP facts + County Card constants. Writes SVA-only scores.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Stats & Calculations */}
          <div className="col-span-8 space-y-6">
            {/* Calculator Stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Calculator Outputs
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
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats?.total_pass2_runs || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Calculations</div>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-4 text-center border border-purple-500/20">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="text-3xl font-bold text-purple-400">{stats?.with_feasibility || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">With Feasibility</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/20">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Scale className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="text-3xl font-bold text-emerald-400">{stats?.with_verdict || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">With Verdict</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calculator Types */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  Calculator Modules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: 'Feasibility Engine', desc: 'ROI & viability scoring', icon: DollarSign },
                    { name: 'Reverse Feasibility', desc: 'Max land price calculations', icon: TrendingUp },
                    { name: 'Fusion Model', desc: 'Combined signal synthesis', icon: Target },
                    { name: 'Verdict Engine', desc: 'Final go/no-go decision', icon: Scale },
                  ].map(calc => (
                    <div key={calc.name} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <calc.icon className="h-4 w-4 text-purple-400" />
                        <span className="font-medium text-sm">{calc.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{calc.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Calculations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Calculations</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : recentCalcs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No calculations recorded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentCalcs.map(calc => (
                      <div 
                        key={calc.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Calculator className="h-4 w-4 text-purple-400" />
                          <div>
                            <div className="text-sm font-mono text-foreground">
                              {calc.id.slice(0, 8)}...
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(calc.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {calc.feasibility && Object.keys(calc.feasibility).length > 0 && (
                            <Badge variant="outline" className="border-purple-500/50 text-purple-400 text-xs">
                              Feasibility
                            </Badge>
                          )}
                          {calc.verdict && Object.keys(calc.verdict).length > 0 && (
                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">
                              Verdict
                            </Badge>
                          )}
                          <Badge 
                            variant="outline" 
                            className={
                              calc.status === 'completed' 
                                ? 'border-emerald-500/50 text-emerald-400'
                                : 'border-muted-foreground/30 text-muted-foreground'
                            }
                          >
                            {calc.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Sub-Hub Contract */}
          <div className="col-span-4 space-y-6">
            <SubHubCard config={config} showMiniDiagram={true} />
            <RefDataPanel subHubId={config.id} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
