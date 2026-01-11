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
  MapPin, 
  Info, 
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  Navigation
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ParcelStats {
  total_zips_searched: number;
  parcels_discovered: number;
  parcels_promoted: number;
  rejection_rate: number;
  last_search_at: string | null;
}

interface RecentSearch {
  id: string;
  zip_code: string;
  status: string;
  created_at: string;
}

/**
 * Sub-Hub 4 — Parcel Discovery
 * Read-only observation panel for parcel search & promotion
 * Anchors: ZIP (search) + Parcel ID (promotion)
 */
export default function SubHub4Page() {
  const config = subHubs[4];
  const [stats, setStats] = useState<ParcelStats | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch zip_runs for parcel discovery activity
      const { data: zipRuns, count: totalRuns } = await supabase
        .from('zip_runs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      const completedRuns = zipRuns?.filter(r => r.status === 'completed').length || 0;

      setStats({
        total_zips_searched: totalRuns || 0,
        parcels_discovered: 0, // Would need parcel table
        parcels_promoted: 0,
        rejection_rate: 0,
        last_search_at: zipRuns?.[0]?.created_at || null,
      });

      setRecentSearches((zipRuns || []).slice(0, 5).map(r => ({
        id: r.id,
        zip_code: r.zip_code,
        status: r.status || 'pending',
        created_at: r.created_at,
      })));

      setLastRefresh(new Date());
    } catch (error) {
      console.error('[SubHub4] Error fetching data:', error);
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
                <MapPin className={`h-6 w-6 ${config.color}`} />
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
            <span className="font-medium">Read-only observation</span> — This panel displays parcel discovery status. 
            ZIP-driven search, FIPS-validated. No market recalculation.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Stats & Searches */}
          <div className="col-span-8 space-y-6">
            {/* Parcel Stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Parcel Discovery Status
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
                        <Layers className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="text-3xl font-bold text-foreground">{stats?.total_zips_searched || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">ZIPs Searched</div>
                    </div>
                    <div className="bg-cyan-500/10 rounded-lg p-4 text-center border border-cyan-500/20">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="text-3xl font-bold text-cyan-400">{stats?.parcels_discovered || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Parcels Found</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/20">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="text-3xl font-bold text-emerald-400">{stats?.parcels_promoted || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Promoted</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Discovery Process */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  Discovery Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-400">ZIP</span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">Search Scope</div>
                      <div className="text-xs text-muted-foreground">ZIP-driven discovery</div>
                    </div>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-amber-400">FIPS</span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">Validation</div>
                      <div className="text-xs text-muted-foreground">County Card rules</div>
                    </div>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">Promotion</div>
                      <div className="text-xs text-muted-foreground">Parcel ID mint</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent ZIP Searches */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent ZIP Searches</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : recentSearches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No parcel searches recorded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentSearches.map(search => (
                      <div 
                        key={search.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-cyan-400" />
                          <div>
                            <div className="text-sm font-mono font-medium">{search.zip_code}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(search.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            search.status === 'completed' 
                              ? 'border-emerald-500/50 text-emerald-400'
                              : search.status === 'pending'
                              ? 'border-amber-500/50 text-amber-400'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          }
                        >
                          {search.status}
                        </Badge>
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
