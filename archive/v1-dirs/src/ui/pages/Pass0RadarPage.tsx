import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/ui/alert";
import { Badge } from "@/ui/components/ui/badge";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { ArrowLeft, Radar, AlertTriangle, Radio, MapPin, Target } from "lucide-react";
import { supabase } from "@/data/integrations/supabase/client";
import { ZipSignalTable } from "@/ui/components/pass0/ZipSignalTable";

interface SignalRow {
  signal_id: string;
  zip_code: string;
  signal_type: string;
  source_name: string;
  source_url: string | null;
  raw_excerpt: string | null;
  signal_strength_hint: "low" | "medium" | "high" | null;
  signal_category_version: string;
  observed_at: string;
}

interface ZipSignalGroup {
  zip_code: string;
  signal_count: number;
  latest_signal_at: string | null;
  signals: SignalRow[];
}

interface RadarData {
  sovereign_id: string;
  asset_type: string;
  anchor_zip: string;
  radius_miles: number;
  total_signals: number;
  zip_count: number;
  zips: ZipSignalGroup[];
}

export default function Pass0RadarPage() {
  const { svaId } = useParams<{ svaId: string }>();
  const [data, setData] = useState<RadarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRadarData = async () => {
      if (!svaId) {
        setError("No Sovereign ID provided");
        setIsLoading(false);
        return;
      }

      try {
        const { data: radarData, error: fnError } = await supabase.functions.invoke(
          "pass0_get_signals",
          { body: { sovereign_id: svaId } }
        );

        if (fnError) throw new Error(fnError.message);
        if (radarData?.error) throw new Error(radarData.error);

        setData(radarData);
      } catch (err) {
        console.error("[Pass0RadarPage] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to load radar data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRadarData();
  }, [svaId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/sva/${svaId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to SVA
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Radar className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold">Pass 0 Signal Radar</h1>
                  <p className="text-sm text-muted-foreground font-mono">{svaId?.slice(0, 12)}...</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              <Radio className="h-3 w-3 mr-1" />
              Read-Only
            </Badge>
          </div>
        </div>
      </div>

      {/* Doctrine Banner */}
      <div className="container mx-auto px-4 py-4">
        <Alert className="border-primary/30 bg-primary/5">
          <Radar className="h-4 w-4" />
          <AlertTitle>Pass 0: ZIP-Anchored Signal Radar</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Signals are non-authoritative smoke indicators. This pass detects early weak signals—not conclusions.
            No edits allowed—signals are ingested externally.
          </AlertDescription>
        </Alert>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Sovereign Context Card */}
        {data && !isLoading && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Sovereign ID Scope
                </CardTitle>
                <CardDescription>Market mandate defining signal collection boundary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Asset Type</p>
                    <p className="font-medium">{data.asset_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Anchor ZIP</p>
                    <p className="font-mono font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {data.anchor_zip}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Radius</p>
                    <p className="font-medium">{data.radius_miles} mi</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">ZIPs in Scope</p>
                    <p className="font-medium">{data.zip_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Signals</p>
                    <Badge variant={data.total_signals > 0 ? "default" : "secondary"}>
                      {data.total_signals}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ZIP Signal Table */}
            <ZipSignalTable zips={data.zips} anchorZip={data.anchor_zip} />
          </>
        )}
      </div>
    </div>
  );
}
