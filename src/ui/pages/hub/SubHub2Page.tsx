import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import { Alert, AlertDescription } from "@/ui/components/ui/alert";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { AnchorBadge } from "@/ui/components/AnchorBadge";
import { SubHubCard } from "@/ui/components/SubHubCard";
import { RefDataPanel } from "@/ui/components/RefDataPanel";
import { subHubs } from "@/sys/config/discover-page-config";
import { supabase } from "@/data/integrations/supabase/client";
import { useState, useEffect } from "react";
import { 
  Building2, 
  Info, 
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Map
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JurisdictionStats {
  total_drafts: number;
  complete_cards: number;
  incomplete_cards: number;
  with_prohibitions: number;
  states_covered: number;
  last_collection_at: string | null;
}

interface RecentDraft {
  id: string;
  county_name: string;
  state_code: string;
  card_complete: boolean;
  fatal_prohibition: string | null;
  created_at: string;
}

/**
 * Sub-Hub 2 — County Card (Constants)
 * Read-only observation panel for jurisdiction rules & constants
 * Anchor: County FIPS
 */
export default function SubHub2Page() {
  const config = subHubs[2];
  const [stats, setStats] = useState<JurisdictionStats | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<RecentDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch jurisdiction card drafts
      const { data: drafts, count: totalDrafts } = await supabase
        .from('jurisdiction_card_drafts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Calculate stats
      const complete = drafts?.filter(d => d.card_complete).length || 0;
      const withProhibitions = drafts?.filter(d => d.fatal_prohibition && d.fatal_prohibition !== 'unknown').length || 0;
      const states = new Set(drafts?.map(d => d.state_code) || []);

      setStats({
        total_drafts: totalDrafts || 0,
        complete_cards: complete,
        incomplete_cards: (totalDrafts || 0) - complete,
        with_prohibitions: withProhibitions,
        states_covered: states.size,
        last_collection_at: drafts?.[0]?.created_at || null,
      });

      setRecentDrafts((drafts || []).slice(0, 5).map(d => ({
        id: d.id,
        county_name: d.county_name || 'Unknown',
        state_code: d.state_code,
        card_complete: d.card_complete || false,
        fatal_prohibition: d.fatal_prohibition,
        created_at: d.created_at || '',
      })));

      setLastRefresh(new Date());
    } catch (error) {
      console.error('[SubHub2] Error fetching data:', error);
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
                <Building2 className={`h-6 w-6 ${config.color}`} />
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
            <span className="font-medium">Read-only observation</span> — This panel displays jurisdiction card status. 
            No math or calculations — facts only.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Stats & Cards */}
          <div className="col-span-8 space-y-6">
            {/* Jurisdiction Stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  County Card Status
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-foreground">{stats?.total_drafts || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Cards</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/20">
                      <div className="text-3xl font-bold text-emerald-400">{stats?.complete_cards || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Complete</div>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg p-4 text-center border border-amber-500/20">
                      <div className="text-3xl font-bold text-amber-400">{stats?.incomplete_cards || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Incomplete</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-4 text-center border border-red-500/20">
                      <div className="text-3xl font-bold text-red-400">{stats?.with_prohibitions || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">With Prohibitions</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coverage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Map className="h-5 w-5 text-primary" />
                  Geographic Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{stats?.states_covered || 0}</div>
                    <div className="text-sm text-muted-foreground">States Covered</div>
                  </div>
                  <div className="flex-1 text-sm text-muted-foreground">
                    Jurisdiction cards collect zoning posture, ordinances, build constants, and cost indices 
                    at the County FIPS level.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Jurisdiction Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Jurisdiction Cards</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : recentDrafts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No jurisdiction cards collected yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentDrafts.map(draft => (
                      <div 
                        key={draft.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {draft.card_complete ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          ) : draft.fatal_prohibition && draft.fatal_prohibition !== 'unknown' ? (
                            <XCircle className="h-5 w-5 text-red-400" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                          )}
                          <div>
                            <div className="text-sm font-medium">
                              {draft.county_name}, {draft.state_code}
                            </div>
                            {draft.fatal_prohibition && draft.fatal_prohibition !== 'unknown' && (
                              <div className="text-xs text-red-400">
                                Prohibition: {draft.fatal_prohibition}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={
                              draft.card_complete 
                                ? 'border-emerald-500/50 text-emerald-400'
                                : 'border-amber-500/50 text-amber-400'
                            }
                          >
                            {draft.card_complete ? 'Complete' : 'Incomplete'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}
                          </span>
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
