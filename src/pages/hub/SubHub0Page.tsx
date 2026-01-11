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
  Radio, 
  Info, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  FileText,
  MapPin
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SignalStats {
  total_pins: number;
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  recent_runs: number;
  last_run_at: string | null;
}

interface RecentPin {
  id: string;
  raw_title: string;
  confidence: string;
  zip_id: string | null;
  created_at: string;
}

/**
 * Sub-Hub 0 — Signals / Smoke
 * Read-only observation panel for early activity detection
 * Anchors: ZIP + County FIPS
 */
export default function SubHub0Page() {
  const config = subHubs[0];
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [recentPins, setRecentPins] = useState<RecentPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch pin stats
      const { data: pins, count: totalPins } = await supabase
        .from('pass0_narrative_pins')
        .select('id, confidence', { count: 'exact' });

      // Fetch recent pins
      const { data: recent } = await supabase
        .from('pass0_narrative_pins')
        .select('id, raw_title, confidence, zip_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch run stats
      const { data: runs } = await supabase
        .from('pass0_run_log')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      const highConf = pins?.filter(p => p.confidence === 'high').length || 0;
      const medConf = pins?.filter(p => p.confidence === 'medium').length || 0;
      const lowConf = pins?.filter(p => p.confidence === 'low').length || 0;

      setStats({
        total_pins: totalPins || 0,
        high_confidence: highConf,
        medium_confidence: medConf,
        low_confidence: lowConf,
        recent_runs: runs?.length || 0,
        last_run_at: runs?.[0]?.created_at || null,
      });

      setRecentPins(recent || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('[SubHub0] Error fetching data:', error);
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
                <Radio className={`h-6 w-6 ${config.color}`} />
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
            <span className="font-medium">Read-only observation</span> — This panel displays real-time signal 
            detection status. No mutations allowed.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Stats & Activity */}
          <div className="col-span-8 space-y-6">
            {/* Signal Stats Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Signal Detection Status
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
                      <div className="text-3xl font-bold text-foreground">{stats?.total_pins || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Pins</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/20">
                      <div className="text-3xl font-bold text-emerald-400">{stats?.high_confidence || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">High Confidence</div>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg p-4 text-center border border-amber-500/20">
                      <div className="text-3xl font-bold text-amber-400">{stats?.medium_confidence || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Medium Confidence</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-muted-foreground">{stats?.low_confidence || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">Low Confidence</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Signals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Recent Signal Pins
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : recentPins.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No signal pins detected yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPins.map(pin => (
                      <div 
                        key={pin.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">{pin.raw_title}</div>
                            <div className="text-xs text-muted-foreground">
                              {pin.zip_id ? `ZIP: ${pin.zip_id}` : 'No ZIP resolved'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={
                              pin.confidence === 'high' 
                                ? 'border-emerald-500/50 text-emerald-400'
                                : pin.confidence === 'medium'
                                ? 'border-amber-500/50 text-amber-400'
                                : 'border-muted-foreground/30 text-muted-foreground'
                            }
                          >
                            {pin.confidence}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(pin.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Run Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Pipeline Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm">{stats?.recent_runs || 0} recent runs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Last run: {stats?.last_run_at 
                        ? formatDistanceToNow(new Date(stats.last_run_at), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </div>
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
