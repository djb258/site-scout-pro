import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Radio, 
  Play, 
  Target, 
  Square, 
  Eye, 
  ArrowUpRight, 
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

interface Candidate {
  area: { city: string; county: string; state: string };
  signal_score: number;
  signal_density: number;
  primary_drivers: string[];
  source_count: number;
  confidence_level: "high" | "medium" | "low";
  evidence: {
    summary: string;
    sources: { title: string; type: string; snippet: string; date: string }[];
    rationale: string;
  };
}

interface ScanResult {
  process_id: string;
  status: "running" | "completed" | "failed" | "aborted";
  started_at: string;
  completed_at?: string;
  candidates: Candidate[];
}

const Pass0Hub = () => {
  const { toast } = useToast();
  
  // Scan controls
  const [toggles, setToggles] = useState({
    news_events: true,
    permits_zoning: true,
    infrastructure: false,
    storage_industrial: true
  });
  const [states, setStates] = useState("");
  const [industryFocus, setIndustryFocus] = useState("");
  const [lookbackDays, setLookbackDays] = useState(30);
  
  // Execution state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [runtime, setRuntime] = useState(0);
  
  // Evidence drawer
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  
  // Promotion modal state
  const [promotedPayload, setPromotedPayload] = useState<object | null>(null);

  // Runtime counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning && scanResult?.started_at) {
      interval = setInterval(() => {
        const start = new Date(scanResult.started_at).getTime();
        const now = Date.now();
        setRuntime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isScanning, scanResult?.started_at]);

  const runScan = useCallback(async (scanType: "full" | "targeted") => {
    setIsScanning(true);
    setScanResult(null);
    setRuntime(0);

    try {
      const { data, error } = await supabase.functions.invoke('hub0_run_radar', {
        body: {
          scan_type: scanType,
          toggles,
          filters: {
            states: states ? states.split(',').map(s => s.trim().toUpperCase()) : undefined,
            industry_focus: industryFocus || undefined,
            lookback_days: lookbackDays
          }
        }
      });

      if (error) throw error;

      setScanResult(data);
      toast({
        title: "Scan Complete",
        description: `Found ${data.candidates?.length || 0} candidate areas`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Scan failed';
      toast({
        title: "Scan Failed",
        description: errorMessage,
        variant: "destructive"
      });
      setScanResult({
        process_id: crypto.randomUUID(),
        status: "failed",
        started_at: new Date().toISOString(),
        candidates: []
      });
    } finally {
      setIsScanning(false);
    }
  }, [toggles, states, industryFocus, lookbackDays, toast]);

  const abortScan = useCallback(async () => {
    if (!scanResult?.process_id) return;

    try {
      await supabase.functions.invoke('hub0_abort_scan', {
        body: { process_id: scanResult.process_id }
      });

      setIsScanning(false);
      setScanResult(prev => prev ? { ...prev, status: "aborted" } : null);
      toast({
        title: "Scan Aborted",
        description: "Radar scan was terminated",
      });
    } catch (error) {
      toast({
        title: "Abort Failed",
        description: "Could not abort scan",
        variant: "destructive"
      });
    }
  }, [scanResult?.process_id, toast]);

  const promoteCandidate = useCallback(async (candidate: Candidate) => {
    if (!scanResult?.process_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('hub0_promote', {
        body: {
          candidate: {
            city: candidate.area.city,
            county: candidate.area.county,
            state: candidate.area.state,
            signal_score: candidate.signal_score,
            rationale: candidate.evidence.rationale,
            sources: candidate.evidence.sources
          },
          process_id: scanResult.process_id
        }
      });

      if (error) throw error;

      setPromotedPayload(data);
      toast({
        title: "Candidate Promoted",
        description: `${candidate.area.city}, ${candidate.area.state} promoted to Hub 1`,
      });
    } catch (error) {
      toast({
        title: "Promotion Failed",
        description: "Could not promote candidate",
        variant: "destructive"
      });
    }
  }, [scanResult?.process_id, toast]);

  const discardCandidate = useCallback((candidate: Candidate) => {
    setScanResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        candidates: prev.candidates.filter(c => 
          c.area.city !== candidate.area.city || 
          c.area.state !== candidate.area.state
        )
      };
    });

    // Log discard event
    if (scanResult?.process_id) {
      supabase.functions.invoke('hub0_log_event', {
        body: {
          process_id: scanResult.process_id,
          action: 'candidate_discarded',
          status: 'completed',
          metadata: { area: candidate.area }
        }
      });
    }

    toast({
      title: "Candidate Discarded",
      description: `${candidate.area.city}, ${candidate.area.state} removed`,
    });
  }, [scanResult?.process_id, toast]);

  const getStatusIcon = () => {
    if (isScanning) return <Loader2 className="h-4 w-4 animate-spin" />;
    switch (scanResult?.status) {
      case "completed": return <CheckCircle2 className="h-4 w-4" />;
      case "failed": return <AlertCircle className="h-4 w-4" />;
      case "aborted": return <Square className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    if (isScanning) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    switch (scanResult?.status) {
      case "completed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "failed": return "bg-destructive/20 text-destructive border-destructive/30";
      case "aborted": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case "high": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">High</Badge>;
      case "medium": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Medium</Badge>;
      default: return <Badge className="bg-muted text-muted-foreground">Low</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 65) return "text-amber-400";
    return "text-muted-foreground";
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
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <Radio className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground font-mono">Hub 0 — Radar</h1>
                <p className="text-muted-foreground">Signal Detection • No Persistence</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
              Ephemeral / Cloud-Only
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Radar Controls Panel */}
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-400" />
              Radar Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => runScan("full")} 
                disabled={isScanning}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run Full Radar Scan
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => runScan("targeted")}
                disabled={isScanning}
              >
                <Target className="mr-2 h-4 w-4" />
                Run Targeted Scan
              </Button>
              <Button 
                variant="destructive" 
                onClick={abortScan}
                disabled={!isScanning}
              >
                <Square className="mr-2 h-4 w-4" />
                Abort Scan
              </Button>
            </div>

            <Separator />

            {/* Signal Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <Label htmlFor="news" className="text-sm">News / Events</Label>
                <Switch 
                  id="news"
                  checked={toggles.news_events}
                  onCheckedChange={(checked) => setToggles(t => ({ ...t, news_events: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <Label htmlFor="permits" className="text-sm">Permits / Zoning</Label>
                <Switch 
                  id="permits"
                  checked={toggles.permits_zoning}
                  onCheckedChange={(checked) => setToggles(t => ({ ...t, permits_zoning: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <Label htmlFor="infra" className="text-sm">Infrastructure / Logistics</Label>
                <Switch 
                  id="infra"
                  checked={toggles.infrastructure}
                  onCheckedChange={(checked) => setToggles(t => ({ ...t, infrastructure: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <Label htmlFor="storage" className="text-sm">Storage / RV / Industrial</Label>
                <Switch 
                  id="storage"
                  checked={toggles.storage_industrial}
                  onCheckedChange={(checked) => setToggles(t => ({ ...t, storage_industrial: checked }))}
                />
              </div>
            </div>

            <Separator />

            {/* Filter Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="states" className="text-sm text-muted-foreground">States (comma-separated)</Label>
                <Input 
                  id="states"
                  placeholder="MD, VA, WV, PA"
                  value={states}
                  onChange={(e) => setStates(e.target.value)}
                  className="font-mono bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-sm text-muted-foreground">Industry Focus (optional)</Label>
                <Input 
                  id="industry"
                  placeholder="e.g., distribution, logistics"
                  value={industryFocus}
                  onChange={(e) => setIndustryFocus(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lookback" className="text-sm text-muted-foreground">Lookback Window (days)</Label>
                <Input 
                  id="lookback"
                  type="number"
                  min={7}
                  max={365}
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(parseInt(e.target.value) || 30)}
                  className="font-mono bg-muted/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Execution Status Panel */}
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Execution Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Run ID</p>
                <p className="font-mono text-sm truncate">
                  {scanResult?.process_id?.slice(0, 8) || "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Start Time</p>
                <p className="font-mono text-sm">
                  {scanResult?.started_at 
                    ? new Date(scanResult.started_at).toLocaleTimeString() 
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Runtime</p>
                <p className="font-mono text-sm">
                  {isScanning ? `${runtime}s` : scanResult ? `${runtime}s` : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                <Badge variant="outline" className={`font-mono ${getStatusColor()}`}>
                  {getStatusIcon()}
                  <span className="ml-1.5">
                    {isScanning ? "Running" : scanResult?.status || "Idle"}
                  </span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar Results Table */}
        {scanResult && scanResult.candidates.length > 0 && (
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-400" />
                Radar Results
                <Badge variant="secondary" className="ml-2">{scanResult.candidates.length} candidates</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-mono text-xs">Candidate Area</TableHead>
                      <TableHead className="font-mono text-xs text-center">Signal Score</TableHead>
                      <TableHead className="font-mono text-xs text-center">Density</TableHead>
                      <TableHead className="font-mono text-xs">Primary Drivers</TableHead>
                      <TableHead className="font-mono text-xs text-center">Sources</TableHead>
                      <TableHead className="font-mono text-xs text-center">Confidence</TableHead>
                      <TableHead className="font-mono text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResult.candidates.map((candidate, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/20">
                        <TableCell className="font-medium">
                          {candidate.area.city}, {candidate.area.county}
                          <span className="text-muted-foreground ml-1">({candidate.area.state})</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-mono font-bold ${getScoreColor(candidate.signal_score)}`}>
                            {candidate.signal_score}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {candidate.signal_density.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {candidate.primary_drivers.slice(0, 3).map((driver, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {driver}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {candidate.source_count}
                        </TableCell>
                        <TableCell className="text-center">
                          {getConfidenceBadge(candidate.confidence_level)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedCandidate(candidate);
                                setIsEvidenceOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              onClick={() => promoteCandidate(candidate)}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => discardCandidate(candidate)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {scanResult && scanResult.candidates.length === 0 && scanResult.status !== "running" && (
          <Card className="border-border bg-card/50">
            <CardContent className="py-12 text-center">
              <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Candidates Found</h3>
              <p className="text-muted-foreground text-sm">
                Try adjusting your signal toggles or expanding the state filter
              </p>
            </CardContent>
          </Card>
        )}

        {/* Promoted Payload Display */}
        {promotedPayload && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-mono flex items-center gap-2 text-emerald-400">
                <ArrowUpRight className="h-5 w-5" />
                Hub 1 Handoff Payload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/30 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                {JSON.stringify(promotedPayload, null, 2)}
              </pre>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setPromotedPayload(null)}
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Evidence Drawer */}
      <Sheet open={isEvidenceOpen} onOpenChange={setIsEvidenceOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">
              {selectedCandidate?.area.city}, {selectedCandidate?.area.state}
            </SheetTitle>
            <SheetDescription>
              Signal Evidence & Rationale
            </SheetDescription>
          </SheetHeader>
          
          {selectedCandidate && (
            <div className="mt-6 space-y-6">
              {/* Summary */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Signal Summary
                </h4>
                <p className="text-foreground">{selectedCandidate.evidence.summary}</p>
              </div>

              <Separator />

              {/* Rationale */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Why This Area Surfaced
                </h4>
                <p className="text-foreground">{selectedCandidate.evidence.rationale}</p>
              </div>

              <Separator />

              {/* Sources */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Source Evidence ({selectedCandidate.evidence.sources.length})
                </h4>
                <div className="space-y-3">
                  {selectedCandidate.evidence.sources.map((source, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{source.title}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {source.type}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-1">{source.snippet}</p>
                      <p className="text-xs text-muted-foreground font-mono">{source.date}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    promoteCandidate(selectedCandidate);
                    setIsEvidenceOpen(false);
                  }}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Promote to Hub 1
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setIsEvidenceOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Pass0Hub;
