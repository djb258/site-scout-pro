import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AnchorBadge } from "@/components/AnchorBadge";
import { SubHubCard } from "@/components/SubHubCard";
import { subHubs } from "@/config/discover-page-config";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { 
  Scale, 
  Info, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Gavel,
  ShieldCheck,
  ShieldX
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DealGateStats {
  total_decisions: number;
  good_deals: number;
  bad_deals: number;
  pending_decisions: number;
  approval_rate: number;
  last_decision_at: string | null;
}

interface RecentDecision {
  id: string;
  decision: string;
  final_score: number | null;
  created_at: string;
}

/**
 * Sub-Hub 5 — Deal Gate (Doctrine)
 * Read-only observation panel for final GOOD/BAD decisions
 * Anchors: SVA + Parcel ID
 */
export default function SubHub5Page() {
  const config = subHubs[5];
  const [stats, setStats] = useState<DealGateStats | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch site results for deal gate decisions
      const { data: results, count: totalResults } = await supabase
        .from('site_results_staging')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      const goodDeals = results?.filter(r => 
        r.decision?.toLowerCase().includes('good') || 
        r.decision?.toLowerCase().includes('go') ||
        (r.final_score && r.final_score >= 70)
      ).length || 0;
      
      const badDeals = results?.filter(r => 
        r.decision?.toLowerCase().includes('bad') || 
        r.decision?.toLowerCase().includes('no-go') ||
        (r.final_score && r.final_score < 50)
      ).length || 0;

      const approvalRate = (totalResults || 0) > 0 
        ? Math.round((goodDeals / (totalResults || 1)) * 100) 
        : 0;

      setStats({
        total_decisions: totalResults || 0,
        good_deals: goodDeals,
        bad_deals: badDeals,
        pending_decisions: (totalResults || 0) - goodDeals - badDeals,
        approval_rate: approvalRate,
        last_decision_at: results?.[0]?.created_at || null,
      });

      setRecentDecisions((results || []).slice(0, 5).map(r => ({
        id: r.id,
        decision: r.decision || 'pending',
        final_score: r.final_score,
        created_at: r.created_at,
      })));

      setLastRefresh(new Date());
    } catch (error) {
      console.error('[SubHub5] Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDecisionIcon = (decision: string, score: number | null) => {
    if (decision?.toLowerCase().includes('good') || decision?.toLowerCase().includes('go') || (score && score >= 70)) {
      return <ShieldCheck className="h-5 w-5 text-emerald-400" />;
    }
    if (decision?.toLowerCase().includes('bad') || decision?.toLowerCase().includes('no-go') || (score && score < 50)) {
      return <ShieldX className="h-5 w-5 text-red-400" />;
    }
    return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  };

  const getDecisionBadge = (decision: string, score: number | null) => {
    if (decision?.toLowerCase().includes('good') || decision?.toLowerCase().includes('go') || (score && score >= 70)) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">GOOD DEAL</Badge>;
    }
    if (decision?.toLowerCase().includes('bad') || decision?.toLowerCase().includes('no-go') || (score && score < 50)) {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">BAD DEAL</Badge>;
    }
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">PENDING</Badge>;
  };

  return (
    <div className="flex-1 bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <Scale className={`h-6 w-6 ${config.color}`} />
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
            <span className="font-medium">Read-only observation</span> — This panel displays final deal decisions. 
            Binary GOOD/BAD only. No overrides without doctrine exception.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Stats & Decisions */}
          <div className="col-span-8 space-y-6">
            {/* Deal Gate Stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-primary" />
                  Deal Gate Verdicts
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-foreground">{stats?.total_decisions || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Decisions</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/20">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <span className="text-3xl font-bold text-emerald-400">{stats?.good_deals || 0}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Good Deals</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-4 text-center border border-red-500/20">
                      <div className="flex items-center justify-center gap-1">
                        <XCircle className="h-5 w-5 text-red-400" />
                        <span className="text-3xl font-bold text-red-400">{stats?.bad_deals || 0}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Bad Deals</div>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20">
                      <div className="text-3xl font-bold text-primary">{stats?.approval_rate || 0}%</div>
                      <div className="text-xs text-muted-foreground mt-1">Approval Rate</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Doctrine Rules */}
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Doctrine Hard Gates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {[
                    'Any fatal prohibition = automatic BAD DEAL',
                    'Feasibility below doctrine thresholds = BAD DEAL',
                    'Missing critical data = HOLD (not GOOD)',
                    'No overrides without explicit doctrine exception',
                  ].map((rule, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <span className="text-muted-foreground">{rule}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Decisions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Decisions</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : recentDecisions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No decisions recorded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentDecisions.map(decision => (
                      <div 
                        key={decision.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getDecisionIcon(decision.decision, decision.final_score)}
                          <div>
                            <div className="text-sm font-mono text-foreground">
                              {decision.id.slice(0, 8)}...
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {decision.final_score !== null && (
                            <span className="text-sm font-mono text-muted-foreground">
                              Score: {decision.final_score}
                            </span>
                          )}
                          {getDecisionBadge(decision.decision, decision.final_score)}
                        </div>
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
