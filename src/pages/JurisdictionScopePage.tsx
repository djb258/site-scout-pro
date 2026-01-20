import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Target, Info, AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface SovereignId {
  id: string;
  sva_id: string;
  anchor_zip: string;
  anchor_city: string;
  anchor_state: string;
  anchor_county: string;
  anchor_fips: string;
  radius_miles: number;
  asset_type: string;
  status: string;
  zip_count_in_scope: number;
}

interface CountyWithStatus {
  county_name: string;
  county_fips: string;
  state_id: string;
  min_distance_miles: number;
  zip_count: number;
  total_population: number | null;
  card_status: 'PRESENT' | 'PARTIAL' | 'MISSING';
  match_type: 'fips' | 'name_fallback' | 'none';
  card_details: {
    envelope_complete: boolean;
    status: string;
    collected_at: string;
  } | null;
}

interface CountySummary {
  total: number;
  present: number;
  partial: number;
  missing: number;
}

export default function JurisdictionScopePage() {
  const [svaList, setSvaList] = useState<SovereignId[]>([]);
  const [selectedSvaId, setSelectedSvaId] = useState<string | null>(null);
  const [counties, setCounties] = useState<CountyWithStatus[]>([]);
  const [summary, setSummary] = useState<CountySummary>({ total: 0, present: 0, partial: 0, missing: 0 });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoadingSvas, setIsLoadingSvas] = useState(true);
  const [isLoadingCounties, setIsLoadingCounties] = useState(false);

  // Fetch SVA list on mount
  useEffect(() => {
    async function fetchSvas() {
      setIsLoadingSvas(true);
      const { data, error } = await supabase
        .from("sovereign_ids")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch SVAs:", error);
      } else {
        setSvaList(data || []);
        if (data && data.length > 0 && !selectedSvaId) {
          setSelectedSvaId(data[0].sva_id);
        }
      }
      setIsLoadingSvas(false);
    }
    fetchSvas();
  }, []);

  // Fetch counties with card status when SVA selection changes
  useEffect(() => {
    async function fetchCountiesWithStatus() {
      if (!selectedSvaId) {
        setCounties([]);
        setSummary({ total: 0, present: 0, partial: 0, missing: 0 });
        setWarnings([]);
        return;
      }

      setIsLoadingCounties(true);
      try {
        const { data, error } = await supabase.functions.invoke("supply_list_counties_with_card_status", {
          body: { sva_id: selectedSvaId }
        });

        if (error) {
          console.error("Failed to fetch counties:", error);
          setCounties([]);
        } else if (data?.success) {
          setCounties(data.counties || []);
          setSummary(data.summary || { total: 0, present: 0, partial: 0, missing: 0 });
          setWarnings(data.warnings || []);
        } else {
          console.error("Failed to fetch counties:", data?.error);
          setCounties([]);
        }
      } catch (err) {
        console.error("Failed to fetch counties:", err);
        setCounties([]);
      }
      setIsLoadingCounties(false);
    }
    fetchCountiesWithStatus();
  }, [selectedSvaId]);

  const selectedSva = svaList.find((s) => s.sva_id === selectedSvaId);

  const getStatusBadge = (status: CountyWithStatus['card_status']) => {
    switch (status) {
      case 'PRESENT':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            PRESENT
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            PARTIAL
          </Badge>
        );
      case 'MISSING':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Circle className="w-3 h-3 mr-1" />
            MISSING
          </Badge>
        );
    }
  };

  const getMatchTypeIndicator = (matchType: CountyWithStatus['match_type']) => {
    if (matchType === 'name_fallback') {
      return (
        <span className="text-yellow-500" title="Matched via county name (FIPS not available)">
          ⚠️
        </span>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Pass 2: Jurisdiction Scope</h1>
            <p className="text-muted-foreground">
              County/FIPS authority resolution — Read Only
            </p>
          </div>
        </div>
        <Link to="/supply">
          <Button variant="outline" size="sm">
            ← Back to ZIP Scope
          </Button>
        </Link>
      </div>

      {/* Doctrine Alert */}
      <Alert className="border-blue-500/50 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700 dark:text-blue-300">
          Jurisdiction Scope — Read Only
        </AlertTitle>
        <AlertDescription className="text-blue-600 dark:text-blue-400">
          This view shows which counties fall within the selected Sovereign scope.
          County Cards are <strong>reused if present</strong>.
          No jurisdiction data is created or modified in this pass.
        </AlertDescription>
      </Alert>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-700 dark:text-yellow-300">
            Matching Warnings
          </AlertTitle>
          <AlertDescription className="text-yellow-600 dark:text-yellow-400">
            {warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel: SVA Selector + Summary */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Select SVA
            </CardTitle>
            <CardDescription>
              Choose a Sovereign ID to view jurisdiction scope
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSvas ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : svaList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Sovereign IDs found. Create one first.
              </p>
            ) : (
              <Select value={selectedSvaId || ""} onValueChange={setSelectedSvaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Sovereign ID" />
                </SelectTrigger>
                <SelectContent>
                  {svaList.map((sva) => (
                    <SelectItem key={sva.sva_id} value={sva.sva_id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{sva.anchor_zip}</span>
                        <span>•</span>
                        <span>{sva.anchor_city}, {sva.anchor_state}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Selected SVA Details */}
            {selectedSva && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Anchor:</span>
                  <span className="font-medium">{selectedSva.anchor_city}, {selectedSva.anchor_state}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">County:</span>
                  <span>{selectedSva.anchor_county}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Anchor FIPS:</span>
                  <span className="font-mono text-xs">{selectedSva.anchor_fips}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Radius:</span>
                  <Badge variant="outline">{selectedSva.radius_miles} mi</Badge>
                </div>
              </div>
            )}

            {/* Coverage Summary */}
            {selectedSva && !isLoadingCounties && summary.total > 0 && (
              <div className="pt-4 border-t space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Jurisdiction Coverage</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{summary.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-3 rounded bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-2xl font-bold text-green-600">{summary.present}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{summary.partial}</p>
                    <p className="text-xs text-muted-foreground">Partial</p>
                  </div>
                  <div className="p-3 rounded bg-muted border text-center">
                    <p className="text-2xl font-bold">{summary.missing}</p>
                    <p className="text-xs text-muted-foreground">Missing</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: County Table */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Counties in Scope
            </CardTitle>
            <CardDescription>
              {selectedSva 
                ? `${counties.length} counties within ${selectedSva.radius_miles} mi of ${selectedSva.anchor_zip}`
                : "Select an SVA to view jurisdiction scope"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCounties ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : counties.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {selectedSvaId ? "No counties found in scope" : "Select an SVA to view counties"}
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-7 gap-2 px-4 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                  <span className="col-span-2">County</span>
                  <span className="text-center">FIPS</span>
                  <span className="text-right">Distance</span>
                  <span className="text-right">ZIPs</span>
                  <span className="text-right">Population</span>
                  <span className="text-center">Card Status</span>
                </div>

                {/* Table Body */}
                <div className="max-h-[500px] overflow-y-auto">
                  {counties.map((county) => {
                    const isAnchor = selectedSva?.anchor_fips === county.county_fips;
                    return (
                      <div
                        key={county.county_fips}
                        className={`grid grid-cols-7 gap-2 px-4 py-3 border-b last:border-b-0 text-sm ${
                          isAnchor ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <span className={`col-span-2 flex items-center gap-2 ${isAnchor ? "font-semibold" : ""}`}>
                          {county.county_name}, {county.state_id}
                          {isAnchor && (
                            <Badge variant="outline" className="text-xs">
                              anchor
                            </Badge>
                          )}
                        </span>
                        <span className="text-center font-mono text-xs text-muted-foreground">
                          {county.county_fips}
                        </span>
                        <span className={`text-right ${isAnchor ? "font-semibold" : "text-muted-foreground"}`}>
                          {county.min_distance_miles.toFixed(1)} mi
                        </span>
                        <span className="text-right text-muted-foreground">
                          {county.zip_count}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {(county.total_population || 0).toLocaleString()}
                        </span>
                        <span className="text-center flex items-center justify-center gap-1">
                          {getStatusBadge(county.card_status)}
                          {getMatchTypeIndicator(county.match_type)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
