import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  ArrowLeft, 
  Search, 
  Play, 
  XCircle, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  MapPin,
  Users,
  Building2,
  DollarSign,
  ArrowRight,
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
  Info,
  Database
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Pass1PipelineCard } from "@/components/Pass1PipelineCard";

// ============================================================================
// CONSTANTS (Match Edge Function)
// ============================================================================
const SCHEMA_VERSION = "v1.0";
const PROCESS_ID = "hub1.pass1";

const ASSET_TYPE_OPTIONS = [
  { id: "traditional_self_storage", label: "Traditional Self-Storage" },
  { id: "climate_controlled", label: "Climate-Controlled" },
  { id: "rv_boat_storage", label: "RV/Boat Storage" },
  { id: "truck_industrial", label: "Truck/Industrial" },
];

const STEPS = [
  { id: "init", label: "Init", index: 0 },
  { id: "zip_hydration", label: "ZIP Hydration", index: 1 },
  { id: "radius_analysis", label: "Radius Analysis", index: 2 },
  { id: "demand_proxies", label: "Demand Proxies", index: 3 },
  { id: "competition_scan", label: "Competition Scan", index: 4 },
  { id: "constraints", label: "Constraints", index: 5 },
  { id: "scoring", label: "Scoring", index: 6 },
  { id: "complete", label: "Complete", index: 7 },
];

// ============================================================================
// TYPES
// ============================================================================
interface Pass1Result {
  run_id: string;
  process_id: string;
  schema_version: string;
  zip: string;
  radius_miles: number;
  zip_metadata: {
    city: string | null;
    county: string | null;
    state: string | null;
    state_id: string | null;
    lat: number | null;
    lng: number | null;
    population: number | null;
    density: number | null;
    income: number | null;
    home_value: number | null;
    rent_median: number | null;
  };
  derived_counties: Array<{
    name: string;
    fips: string;
    population: number;
    distance_miles: number;
  }>;
  total_population_in_radius: number;
  demand_proxies: {
    population: number;
    density: number;
    income: number;
    housing_value: number;
    scores: {
      population_score: number;
      density_score: number;
      income_score: number;
      housing_value_score: number;
      commercial_score: number;
    };
    demand_score: number;
  };
  competition_summary: {
    estimated_count: number;
    rent_bands: { low: number; medium: number; high: number };
    saturation_level: string;
    confidence: "low" | "medium";
  };
  scoring: {
    raw_scores: { demand: number; supply: number; constraints: number };
    weights: { demand: number; supply: number; constraints: number };
    final_score: number;
  };
  viability_score: number;
  decision: "data_collected" | "advance" | "reject" | "insufficient_data";
  warning_flags?: string[];
  confidence_flags: {
    competition: "low" | "medium";
  };
  runtime_ms: number;
  generated_at: string;
}

interface LogEntry {
  id: string;
  step: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface DemandAggRow {
  distance_band: string;
  baseline_demand_sqft: number;
  population_total: number;
}

interface SupplyAggRow {
  distance_band: string;
  facility_count: number;
  supply_sqft_total: number;
  gap_sqft: number;
  confidence: "low" | "medium";
}

// ============================================================================
// COMPONENT
// ============================================================================
const Pass1Hub = () => {
  // Input State
  const [zip, setZip] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(120);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>(["traditional_self_storage"]);
  
  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Results State
  const [result, setResult] = useState<Pass1Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Supply Gap State
  const [demandAgg, setDemandAgg] = useState<DemandAggRow[]>([]);
  const [supplyAgg, setSupplyAgg] = useState<SupplyAggRow[]>([]);
  
  // Pipeline Card State
  const [radiusCount, setRadiusCount] = useState<number>(0);
  const [censusCount, setCensusCount] = useState<number>(0);
  const [supplySnapshotCount, setSupplySnapshotCount] = useState<number>(0);
  
  // Promotion State
  const [promotionPayload, setPromotionPayload] = useState<Record<string, unknown> | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Fetch pipeline data when runId changes
  useEffect(() => {
    const fetchPipelineData = async () => {
      if (!runId) {
        setDemandAgg([]);
        setSupplyAgg([]);
        setRadiusCount(0);
        setCensusCount(0);
        setSupplySnapshotCount(0);
        return;
      }
      
      // Fetch all pipeline data in parallel
      const [radiusRes, censusRes, demandRes, supplyAggRes, supplySnapshotRes] = await Promise.all([
        supabase.from('pass1_radius_zip').select('id', { count: 'exact', head: true }).eq('run_id', runId),
        supabase.from('pass1_census_snapshot').select('id', { count: 'exact', head: true }).eq('run_id', runId),
        supabase.from('pass1_demand_agg').select('distance_band, baseline_demand_sqft, population_total').eq('run_id', runId),
        supabase.from('pass1_supply_agg').select('distance_band, facility_count, supply_sqft_total, gap_sqft, confidence').eq('run_id', runId),
        supabase.from('pass1_supply_snapshot').select('id', { count: 'exact', head: true }).eq('run_id', runId),
      ]);
      
      setRadiusCount(radiusRes.count || 0);
      setCensusCount(censusRes.count || 0);
      if (demandRes.data) setDemandAgg(demandRes.data as DemandAggRow[]);
      if (supplyAggRes.data) setSupplyAgg(supplyAggRes.data as SupplyAggRow[]);
      setSupplySnapshotCount(supplySnapshotRes.count || 0);
    };
    
    fetchPipelineData();
  }, [runId, result]);

  // Generate UUID
  const generateUUID = () => crypto.randomUUID();

  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}.${remainingMs}`;
  };

  // Toggle asset type
  const toggleAssetType = (id: string) => {
    setSelectedAssetTypes(prev => 
      prev.includes(id) 
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  };

  // Run Pass 1
  const handleRunPass1 = async () => {
    if (!zip || zip.length !== 5 || selectedAssetTypes.length === 0) {
      setError("Please enter a valid 5-digit ZIP code and select at least one asset type.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setPromotionPayload(null);
    setCurrentStep("init");
    setStartTime(Date.now());
    setElapsedTime(0);

    const newRunId = generateUUID();
    setRunId(newRunId);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('hub1_run_pass1', {
        body: {
          zip,
          radius_miles: radiusMiles,
          asset_types: selectedAssetTypes,
          run_id: newRunId
        }
      });

      if (fnError) throw fnError;

      setResult(data);
      setCurrentStep("complete");

      // Fetch logs for this run
      const { data: logData } = await supabase
        .from('hub1_pass1_run_log')
        .select('*')
        .eq('run_id', newRunId)
        .order('created_at', { ascending: true });

      if (logData) {
        setLogs(logData as LogEntry[]);
      }

    } catch (err) {
      console.error('[PASS1_UI] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setCurrentStep(null);
    } finally {
      setIsRunning(false);
    }
  };

  // Cancel (abort) - just resets UI state since the function runs synchronously
  const handleCancel = () => {
    setIsRunning(false);
    setCurrentStep(null);
    setError("Run cancelled by user");
  };

  // Promote to Hub 2 (emit payload only - no data mutation)
  const handlePromote = async () => {
    if (!result || result.decision !== "advance") return;

    setIsPromoting(true);

    const payload = {
      source_hub: "hub1",
      source_run_id: result.run_id,
      decision: result.decision,
      confidence_flags: {
        competition: result.competition_summary.confidence
      },
      area: {
        zip: result.zip,
        city: result.zip_metadata.city,
        county: result.zip_metadata.county,
        state: result.zip_metadata.state
      },
      viability_score: result.viability_score,
      schema_version: result.schema_version,
      generated_at: new Date().toISOString()
    };

    try {
      // Log the promotion event
      await supabase.functions.invoke('hub1_log_event', {
        body: {
          run_id: result.run_id,
          action: 'promoted_to_hub2',
          status: 'completed',
          metadata: payload
        }
      });

      // Display payload (NO storage, NO mutation)
      setPromotionPayload(payload);
    } catch (err) {
      console.error('[PASS1_UI] Promotion error:', err);
      setError('Failed to log promotion event');
    } finally {
      setIsPromoting(false);
    }
  };

  // Get decision styles
  const getDecisionStyles = (decision: string) => {
    switch (decision) {
      case "advance":
        return { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-400", icon: CheckCircle2 };
      case "reject":
        return { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-400", icon: XCircle };
      case "data_collected":
        return { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400", icon: Database };
      default:
        return { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-400", icon: AlertTriangle };
    }
  };

  // Get confidence badge styles
  const getConfidenceBadge = (confidence: "low" | "medium") => {
    if (confidence === "medium") {
      return <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">Medium Confidence</Badge>;
    }
    return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">Low Confidence</Badge>;
  };

  // Get step progress
  const getStepProgress = () => {
    if (!currentStep) return 0;
    const step = STEPS.find(s => s.id === currentStep);
    return step ? ((step.index + 1) / STEPS.length) * 100 : 0;
  };

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
              <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center">
                <Search className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Hub 1 — Pass 1 Exploration</h1>
                <p className="text-muted-foreground">Cheap Reject-First Market Recon</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                Schema {SCHEMA_VERSION}
              </Badge>
              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                No Persistence / Cloud-Only
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Input Controls */}
          <div className="space-y-6">
            {/* Input Panel */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-500" />
                  Input Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ZIP Code */}
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="Enter 5-digit ZIP"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    maxLength={5}
                    className="font-mono"
                    disabled={isRunning}
                  />
                </div>

                {/* Radius */}
                <div className="space-y-2">
                  <Label>Radius: {radiusMiles} miles</Label>
                  <Slider
                    value={[radiusMiles]}
                    onValueChange={(v) => setRadiusMiles(v[0])}
                    min={50}
                    max={200}
                    step={10}
                    disabled={isRunning}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>50 mi</span>
                    <span>200 mi</span>
                  </div>
                </div>

                {/* Asset Types */}
                <div className="space-y-3">
                  <Label>Asset Types</Label>
                  {ASSET_TYPE_OPTIONS.map((type) => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={type.id}
                        checked={selectedAssetTypes.includes(type.id)}
                        onCheckedChange={() => toggleAssetType(type.id)}
                        disabled={isRunning}
                      />
                      <label
                        htmlFor={type.id}
                        className="text-sm cursor-pointer"
                      >
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleRunPass1}
                    disabled={isRunning || !zip || zip.length !== 5 || selectedAssetTypes.length === 0}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Run Pass 1
                  </Button>
                  {isRunning && (
                    <Button variant="destructive" onClick={handleCancel}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded bg-destructive/10 border border-destructive/50 text-destructive text-sm">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execution Status */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Execution Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Run ID</span>
                    <p className="font-mono text-xs truncate">{runId || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Process ID</span>
                    <p className="font-mono text-xs">{PROCESS_ID}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p>
                      {isRunning ? (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Running</Badge>
                      ) : result ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Complete</Badge>
                      ) : error ? (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/50">Failed</Badge>
                      ) : (
                        <Badge variant="outline">Idle</Badge>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Runtime</span>
                    <p className="font-mono">{formatTime(result?.runtime_ms || elapsedTime)}</p>
                  </div>
                </div>

                {/* Step Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{currentStep || "—"}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${getStepProgress()}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    {STEPS.map((step) => (
                      <span 
                        key={step.id}
                        className={currentStep === step.id ? "text-amber-400" : ""}
                      >
                        {step.index + 1}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pipeline Card - Always visible when we have a run */}
            {runId && (
              <Pass1PipelineCard
                runId={runId}
                radiusData={radiusCount > 0 ? { zipCount: radiusCount, originZip: zip } : null}
                censusData={censusCount > 0 ? { zipCount: censusCount, vintageYear: 2023 } : null}
                demandData={demandAgg.length > 0 ? {
                  totalSqft: demandAgg.reduce((sum, d) => sum + Number(d.baseline_demand_sqft), 0),
                  bands: demandAgg.map(d => ({
                    band: d.distance_band,
                    population: d.population_total,
                    demandSqft: Number(d.baseline_demand_sqft),
                  })),
                } : null}
                supplySnapshotData={supplySnapshotCount > 0 ? {
                  facilityCount: supplySnapshotCount,
                  source: "mock",
                  confidence: "low",
                } : null}
                supplyGapData={supplyAgg.length > 0 ? {
                  netGapSqft: supplyAgg.reduce((sum, s) => sum + Number(s.gap_sqft), 0),
                  bands: supplyAgg.map(s => ({
                    band: s.distance_band,
                    demandSqft: demandAgg.find(d => d.distance_band === s.distance_band)?.baseline_demand_sqft || 0,
                    supplySqft: Number(s.supply_sqft_total),
                    gapSqft: Number(s.gap_sqft),
                    confidence: s.confidence,
                  })),
                } : null}
                error={error}
                isRunning={isRunning}
              />
            )}
            
            {!result && !runId ? (
              <Card className="border-border bg-card h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center text-muted-foreground">
                  <Search className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>Enter a ZIP code and run Pass 1 to see results</p>
                </div>
              </Card>
            ) : !result ? (
              <Card className="border-border bg-card h-full flex items-center justify-center min-h-[200px]">
                <div className="text-center text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-2 opacity-30 animate-pulse" />
                  <p>Processing...</p>
                </div>
              </Card>
            ) : (
              <>
                {/* Decision Card */}
                <Card className={`border ${getDecisionStyles(result.decision).border} ${getDecisionStyles(result.decision).bg}`}>
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {(() => {
                          const Icon = getDecisionStyles(result.decision).icon;
                          return <Icon className={`h-12 w-12 ${getDecisionStyles(result.decision).text}`} />;
                        })()}
                        <div>
                          <h2 className={`text-2xl font-bold uppercase ${getDecisionStyles(result.decision).text}`}>
                            {result.decision.replace("_", " ")}
                          </h2>
                          {result.warning_flags && result.warning_flags.length > 0 && (
                            <p className="text-sm text-muted-foreground">Warnings: {result.warning_flags.join(", ")}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-5xl font-bold ${getDecisionStyles(result.decision).text}`}>
                          {result.viability_score ?? 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">Viability Score</p>
                      </div>
                    </div>

                    {result.decision === "advance" && (
                      <div className="mt-6 pt-4 border-t border-border/30">
                        <Button
                          onClick={handlePromote}
                          disabled={isPromoting}
                          className="bg-emerald-500 hover:bg-emerald-600 text-black"
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Promote to Hub 2
                        </Button>
                        {promotionPayload && (
                          <div className="mt-4 p-3 rounded bg-card/50 border border-border">
                            <p className="text-xs text-muted-foreground mb-2">Promotion Payload (Event Only - No Mutation)</p>
                            <pre className="text-xs font-mono overflow-auto max-h-32">
                              {JSON.stringify(promotionPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ZIP Metadata */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-amber-500" />
                        ZIP Metadata
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span>{result.zip_metadata.city}, {result.zip_metadata.state_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">County</span>
                        <span>{result.zip_metadata.county}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Population</span>
                        <span>{result.zip_metadata.population?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Density</span>
                        <span>{result.zip_metadata.density?.toLocaleString()}/mi²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Median Income</span>
                        <span>${result.zip_metadata.income?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Home Value</span>
                        <span>${result.zip_metadata.home_value?.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Radius Analysis */}
                  {result.derived_counties && (
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-amber-500" />
                        Radius Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Radius</span>
                        <span>{result.radius_miles} miles</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Counties</span>
                        <span>{result.derived_counties.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Population</span>
                        <span>{result.total_population_in_radius?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <Separator />
                      <div className="max-h-24 overflow-auto">
                        <p className="text-xs text-muted-foreground mb-1">Nearby Counties:</p>
                        {result.derived_counties.slice(0, 5).map((county, i) => (
                          <div key={i} className="text-xs flex justify-between">
                            <span>{county.name}</span>
                            <span className="text-muted-foreground">{county.distance_miles} mi</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  )}

                  {/* Demand Proxies */}
                  {result.demand_proxies && (
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-500" />
                        Demand Proxies
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Population Score</span>
                          <span>{result.demand_proxies.scores.population_score}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${result.demand_proxies.scores.population_score}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Density Score</span>
                          <span>{result.demand_proxies.scores.density_score}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${result.demand_proxies.scores.density_score}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Income Score</span>
                          <span>{result.demand_proxies.scores.income_score}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${result.demand_proxies.scores.income_score}%` }} />
                        </div>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Overall Demand</span>
                        <span className="text-amber-400">{result.demand_proxies.demand_score}</span>
                      </div>
                    </CardContent>
                  </Card>
                  )}

                  {/* Competition Summary */}
                  {result.competition_summary && (
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-amber-500" />
                        Competition Summary
                        {getConfidenceBadge(result.competition_summary.confidence)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Competitors</span>
                        <span>{result.competition_summary.estimated_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saturation Level</span>
                        <Badge variant="outline" className={
                          result.competition_summary.saturation_level === 'undersaturated' ? 'border-emerald-500/50 text-emerald-400' :
                          result.competition_summary.saturation_level === 'moderate' ? 'border-amber-500/50 text-amber-400' :
                          'border-red-500/50 text-red-400'
                        }>
                          {result.competition_summary.saturation_level}
                        </Badge>
                      </div>
                      <Separator />
                      <p className="text-xs text-muted-foreground">Estimated Rent Bands:</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-xs text-muted-foreground">Low</p>
                          <p className="font-mono">${result.competition_summary.rent_bands.low}</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-xs text-muted-foreground">Med</p>
                          <p className="font-mono">${result.competition_summary.rent_bands.medium}</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-xs text-muted-foreground">High</p>
                          <p className="font-mono">${result.competition_summary.rent_bands.high}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )}
                </div>

                {/* Demand vs Supply Gap Panel */}
                {demandAgg.length > 0 && (
                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                        Demand vs Supply Gap
                        {supplyAgg.length === 0 && (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs ml-2">
                            Supply not computed
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {supplyAgg.length === 0 ? (
                        // Demand-only table
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Supply not computed for this run
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 text-muted-foreground font-medium">Band</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">Population</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">Baseline Demand (sqft)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {["0-30", "30-60", "60-120"].map((band) => {
                                  const row = demandAgg.find(d => d.distance_band === band);
                                  return (
                                    <tr key={band} className="border-b border-border/50">
                                      <td className="py-2 font-mono">{band} mi</td>
                                      <td className="py-2 text-right">{row?.population_total?.toLocaleString() ?? "—"}</td>
                                      <td className="py-2 text-right font-mono">{row?.baseline_demand_sqft?.toLocaleString() ?? "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        // Full demand + supply + gap table
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 text-muted-foreground font-medium">Band</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Demand (sqft)</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Supply (sqft)</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Gap (sqft)</th>
                                <th className="text-center py-2 text-muted-foreground font-medium">Conf</th>
                              </tr>
                            </thead>
                            <tbody>
                              {["0-30", "30-60", "60-120"].map((band) => {
                                const demand = demandAgg.find(d => d.distance_band === band);
                                const supply = supplyAgg.find(s => s.distance_band === band);
                                const gap = supply?.gap_sqft ?? 0;
                                const gapColorClass = gap > 0 ? "text-emerald-400" : gap < 0 ? "text-red-400" : "";
                                
                                return (
                                  <tr key={band} className="border-b border-border/50">
                                    <td className="py-2 font-mono">{band} mi</td>
                                    <td className="py-2 text-right font-mono">{demand?.baseline_demand_sqft?.toLocaleString() ?? "—"}</td>
                                    <td className="py-2 text-right font-mono">{supply?.supply_sqft_total?.toLocaleString() ?? "—"}</td>
                                    <td className={`py-2 text-right font-mono font-medium ${gapColorClass}`}>
                                      {gap > 0 ? "+" : ""}{gap.toLocaleString()}
                                    </td>
                                    <td className="py-2 text-center">
                                      {supply && (
                                        <Badge 
                                          variant="outline" 
                                          className={
                                            supply.confidence === "medium" 
                                              ? "border-amber-500/50 text-amber-400 text-xs" 
                                              : "border-muted-foreground/30 text-muted-foreground text-xs"
                                          }
                                        >
                                          {supply.confidence}
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Scoring Breakdown */}
                {result.scoring && (
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                      Scoring Breakdown (Deterministic)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="p-4 rounded bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Demand</p>
                        <p className="text-2xl font-bold text-amber-400">{result.scoring.raw_scores?.demand ?? 'N/A'}</p>
                        <p className="text-[10px] text-muted-foreground">× {result.scoring.weights?.demand ?? '-'}</p>
                      </div>
                      <div className="p-4 rounded bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Supply Gap</p>
                        <p className="text-2xl font-bold text-amber-400">{result.scoring.raw_scores?.supply ?? 'N/A'}</p>
                        <p className="text-[10px] text-muted-foreground">× {result.scoring.weights?.supply ?? '-'}</p>
                      </div>
                      <div className="p-4 rounded bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Constraints</p>
                        <p className="text-2xl font-bold text-amber-400">{result.scoring.raw_scores?.constraints ?? 'N/A'}</p>
                        <p className="text-[10px] text-muted-foreground">× {result.scoring.weights?.constraints ?? '-'}</p>
                      </div>
                      <div className={`p-4 rounded text-center ${getDecisionStyles(result.decision).bg} border ${getDecisionStyles(result.decision).border}`}>
                        <p className="text-xs text-muted-foreground mb-1">Final Score</p>
                        <p className={`text-2xl font-bold ${getDecisionStyles(result.decision).text}`}>{result.scoring.final_score ?? 'N/A'}</p>
                        <p className="text-[10px] text-muted-foreground">Weighted Sum</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Evidence Drawer */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <FileText className="mr-2 h-4 w-4" />
                      View Execution Log ({logs.length} entries)
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                      <SheetTitle>Execution Log</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                      <div className="space-y-3">
                        {logs.map((log) => (
                          <div key={log.id} className="p-3 rounded bg-muted/30 border border-border text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="text-xs">
                                {log.step}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              {log.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                              {log.status === 'started' && <Clock className="h-3 w-3 text-amber-400" />}
                              {log.status === 'failed' && <XCircle className="h-3 w-3 text-red-400" />}
                              {log.status === 'rejected' && <AlertCircle className="h-3 w-3 text-red-400" />}
                              <span className="text-xs capitalize">{log.status}</span>
                            </div>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-24">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                        {logs.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">No logs available</p>
                        )}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pass1Hub;
