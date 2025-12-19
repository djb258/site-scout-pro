import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PipelineDocPanel } from "@/components/PipelineDocPanel";
import { 
  Radio, 
  Play, 
  Power, 
  Clock, 
  Loader2,
  AlertTriangle,
  CheckCircle,
  Newspaper,
  FileCheck,
  MapPin,
  List,
  Rss,
  Link as LinkIcon,
  Globe,
  Target
} from "lucide-react";

// Pipeline stage definitions
interface PipelineStage {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  functions: string[];
  sources: { id: string; label: string; enabled: boolean }[];
}

interface StageStatus {
  isRunning: boolean;
  lastRun: string | null;
  itemCount: number;
  errorCount: number;
  killSwitch: boolean;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'news_narratives',
    label: 'Stage 1: News & Narratives',
    description: 'RSS ingestion, manual URLs, content parsing',
    icon: Newspaper,
    functions: ['pass0_source_fetcher', 'pass0_content_parser'],
    sources: [
      { id: 'rss_feeds', label: 'RSS Feeds', enabled: true },
      { id: 'google_news', label: 'Google News', enabled: true },
      { id: 'bizjournals', label: 'BizJournals', enabled: false },
      { id: 'press_releases', label: 'Press Releases', enabled: true }
    ]
  },
  {
    id: 'permits_inspections',
    label: 'Stage 2: Permits & Inspections',
    description: 'Permit feeds, inspection tracking, zoning alerts',
    icon: FileCheck,
    functions: ['pass0_permit_fetcher', 'pass0_inspection_tracker'],
    sources: [
      { id: 'county_permits', label: 'County Permits', enabled: true },
      { id: 'state_filings', label: 'State Filings', enabled: true },
      { id: 'inspection_feeds', label: 'Inspection Feeds', enabled: false },
      { id: 'zoning_changes', label: 'Zoning Changes', enabled: true }
    ]
  },
  {
    id: 'geo_pin_output',
    label: 'Stage 3: Geo Resolution & Pin Output',
    description: 'Location resolution, ZIP mapping, pin emission',
    icon: MapPin,
    functions: ['pass0_geo_resolver', 'pass0_zip_mapper', 'pass0_pin_emitter'],
    sources: [
      { id: 'geocoder', label: 'Geocoder API', enabled: true },
      { id: 'zip_lookup', label: 'ZIP Lookup', enabled: true },
      { id: 'confidence_filter', label: 'Confidence Filter', enabled: true }
    ]
  }
];

// Mock log generator
const generateMockLogs = (stageId: string): LogEntry[] => [
  { id: '1', timestamp: new Date().toISOString(), level: 'info', message: `[${stageId}] Stage initiated` },
  { id: '2', timestamp: new Date(Date.now() - 1000).toISOString(), level: 'info', message: `[${stageId}] Processing batch...` },
  { id: '3', timestamp: new Date(Date.now() - 2000).toISOString(), level: 'warn', message: `[${stageId}] Rate limit warning` },
  { id: '4', timestamp: new Date(Date.now() - 3000).toISOString(), level: 'info', message: `[${stageId}] Items processed: 12` },
  { id: '5', timestamp: new Date(Date.now() - 4000).toISOString(), level: 'info', message: `[${stageId}] Stage complete` },
];

const Pass0Hub = () => {
  const { toast } = useToast();

  // Stage statuses
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(() => {
    const initial: Record<string, StageStatus> = {};
    PIPELINE_STAGES.forEach(stage => {
      initial[stage.id] = {
        isRunning: false,
        lastRun: null,
        itemCount: 0,
        errorCount: 0,
        killSwitch: false
      };
    });
    return initial;
  });

  // Source toggles (per stage)
  const [sourceToggles, setSourceToggles] = useState<Record<string, Record<string, boolean>>>(() => {
    const initial: Record<string, Record<string, boolean>> = {};
    PIPELINE_STAGES.forEach(stage => {
      initial[stage.id] = {};
      stage.sources.forEach(source => {
        initial[stage.id][source.id] = source.enabled;
      });
    });
    return initial;
  });

  // Logs per stage
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});

  // Expanded accordion items
  const [expandedStages, setExpandedStages] = useState<string[]>(['news_narratives']);

  // Manual URL input for Stage 1
  const [manualUrl, setManualUrl] = useState("");

  // Auto-expand stages with active runs or errors
  useEffect(() => {
    const autoExpand: string[] = [];
    Object.entries(stageStatuses).forEach(([stageId, status]) => {
      if (status.isRunning || status.errorCount > 0) {
        autoExpand.push(stageId);
      }
    });
    if (autoExpand.length > 0) {
      setExpandedStages(prev => [...new Set([...prev, ...autoExpand])]);
    }
  }, [stageStatuses]);

  const toggleKillSwitch = async (stageId: string) => {
    const newValue = !stageStatuses[stageId].killSwitch;
    setStageStatuses(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], killSwitch: newValue }
    }));

    toast({
      title: newValue ? "Kill Switch Enabled" : "Kill Switch Disabled",
      description: `Stage ${stageId} ${newValue ? 'halted' : 'resumed'}`,
      variant: newValue ? "destructive" : "default"
    });
  };

  const toggleSource = (stageId: string, sourceId: string) => {
    setSourceToggles(prev => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        [sourceId]: !prev[stageId][sourceId]
      }
    }));
  };

  const runStage = async (stageId: string) => {
    if (stageStatuses[stageId].killSwitch) {
      toast({
        title: "Blocked",
        description: "Kill switch is enabled for this stage",
        variant: "destructive"
      });
      return;
    }

    setStageStatuses(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], isRunning: true }
    }));

    toast({
      title: "Stage Running",
      description: `Starting ${stageId}...`
    });

    // Generate mock logs
    setLogs(prev => ({ ...prev, [stageId]: generateMockLogs(stageId) }));

    try {
      const { data, error } = await supabase.functions.invoke('pass0_orchestrator', {
        body: { 
          trigger: 'manual', 
          stage_id: stageId, 
          sources: Object.entries(sourceToggles[stageId])
            .filter(([_, enabled]) => enabled)
            .map(([id]) => id),
          dry_run: true 
        }
      });

      if (error) throw error;

      const mockItemCount = Math.floor(Math.random() * 25) + 5;
      const mockErrorCount = Math.floor(Math.random() * 2);

      setStageStatuses(prev => ({
        ...prev,
        [stageId]: {
          ...prev[stageId],
          isRunning: false,
          lastRun: new Date().toISOString(),
          itemCount: prev[stageId].itemCount + mockItemCount,
          errorCount: mockErrorCount
        }
      }));

      toast({
        title: "Stage Complete",
        description: `${mockItemCount} items processed, ${mockErrorCount} errors`
      });

    } catch (err) {
      setStageStatuses(prev => ({
        ...prev,
        [stageId]: { 
          ...prev[stageId], 
          isRunning: false, 
          errorCount: prev[stageId].errorCount + 1 
        }
      }));
      toast({
        title: "Stage Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const submitManualUrl = async () => {
    if (!manualUrl.trim()) return;

    try {
      const { error } = await supabase.from('pass0_url_queue').insert({
        url: manualUrl,
        status: 'pending',
        submitted_by: 'manual_ui'
      });

      if (error) throw error;

      toast({
        title: "URL Queued",
        description: "Added to processing queue"
      });
      setManualUrl("");
    } catch (err) {
      toast({
        title: "Failed",
        description: "Could not queue URL",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: StageStatus) => {
    if (status.killSwitch) {
      return <Badge variant="destructive" className="gap-1"><Power className="h-3 w-3" />KILLED</Badge>;
    }
    if (status.isRunning) {
      return <Badge className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30"><Loader2 className="h-3 w-3 animate-spin" />RUNNING</Badge>;
    }
    if (status.errorCount > 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{status.errorCount} ERRORS</Badge>;
    }
    if (status.lastRun) {
      return <Badge className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3" />READY</Badge>;
    }
    return <Badge variant="outline" className="gap-1">IDLE</Badge>;
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStageIcon = (stageId: string) => {
    switch (stageId) {
      case 'news_narratives': return <Newspaper className="h-5 w-5" />;
      case 'permits_inspections': return <FileCheck className="h-5 w-5" />;
      case 'geo_pin_output': return <MapPin className="h-5 w-5" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex-1 bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <Radio className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground font-mono">Hub 0 — Radar Pipeline</h1>
                <p className="text-muted-foreground">Waterfall Intake • News → Permits → Geo Output</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
              Ephemeral / Cloud-Only
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Pipeline Documentation */}
        <PipelineDocPanel passNumber={0} />

        {/* Pipeline Waterfall */}
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              PIPELINE STAGES
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion
              type="multiple"
              value={expandedStages}
              onValueChange={setExpandedStages}
              className="divide-y divide-border"
            >
              {PIPELINE_STAGES.map((stage, index) => {
                const status = stageStatuses[stage.id];
                const StageIcon = stage.icon;

                return (
                  <AccordionItem key={stage.id} value={stage.id} className="border-0">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          {/* Stage number indicator */}
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                            ${status.killSwitch ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}
                          `}>
                            {index + 1}
                          </div>
                          <div className={`p-2 rounded-lg ${status.killSwitch ? 'bg-destructive/10' : 'bg-muted'}`}>
                            <StageIcon className={`h-5 w-5 ${status.killSwitch ? 'text-destructive' : 'text-foreground'}`} />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold font-mono">{stage.label}</div>
                            <div className="text-xs text-muted-foreground">{stage.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(status)}
                          {status.lastRun && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(status.lastRun).toLocaleTimeString()}
                            </div>
                          )}
                          <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {status.itemCount} items
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-6 pb-6">
                      {/* Waterfall connector line */}
                      {index < PIPELINE_STAGES.length - 1 && (
                        <div className="absolute left-10 top-full h-4 w-0.5 bg-border" />
                      )}

                      <div className="grid grid-cols-3 gap-6">
                        {/* Source Registry */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <List className="h-4 w-4" />
                            Source Registry
                          </div>
                          <div className="space-y-2">
                            {stage.sources.map(source => (
                              <div 
                                key={source.id} 
                                className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border"
                              >
                                <div className="flex items-center gap-2">
                                  {stage.id === 'news_narratives' && <Rss className="h-3 w-3 text-muted-foreground" />}
                                  {stage.id === 'permits_inspections' && <FileCheck className="h-3 w-3 text-muted-foreground" />}
                                  {stage.id === 'geo_pin_output' && <Globe className="h-3 w-3 text-muted-foreground" />}
                                  <code className="text-xs">{source.label}</code>
                                </div>
                                <Switch
                                  checked={sourceToggles[stage.id]?.[source.id] ?? source.enabled}
                                  onCheckedChange={() => toggleSource(stage.id, source.id)}
                                  disabled={status.killSwitch}
                                  className="scale-75"
                                />
                              </div>
                            ))}
                          </div>

                          {/* Manual URL injection for Stage 1 */}
                          {stage.id === 'news_narratives' && (
                            <div className="pt-3 space-y-2">
                              <Label className="text-xs text-muted-foreground">Manual URL Injection</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="https://..."
                                  value={manualUrl}
                                  onChange={(e) => setManualUrl(e.target.value)}
                                  className="text-xs h-8 bg-muted/30"
                                />
                                <Button size="sm" variant="secondary" onClick={submitManualUrl} className="h-8">
                                  <LinkIcon className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Controls</div>
                          <div className="space-y-4">
                            <Button 
                              onClick={() => runStage(stage.id)}
                              disabled={status.isRunning || status.killSwitch}
                              className="w-full"
                              variant={status.killSwitch ? 'secondary' : 'default'}
                            >
                              {status.isRunning ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
                              ) : (
                                <><Play className="h-4 w-4 mr-2" />Run Stage</>
                              )}
                            </Button>

                            <Separator />

                            <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                              <div className="flex items-center gap-2">
                                <Power className="h-4 w-4 text-destructive" />
                                <span className="text-sm font-medium">Kill Switch</span>
                              </div>
                              <Switch
                                checked={status.killSwitch}
                                onCheckedChange={() => toggleKillSwitch(stage.id)}
                                className="data-[state=checked]:bg-destructive"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="p-2 rounded bg-muted">
                                <div className="text-lg font-bold font-mono">{status.itemCount}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">Items</div>
                              </div>
                              <div className="p-2 rounded bg-muted">
                                <div className={`text-lg font-bold font-mono ${status.errorCount > 0 ? 'text-destructive' : ''}`}>
                                  {status.errorCount}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase">Errors</div>
                              </div>
                            </div>

                            {/* Functions list */}
                            <div className="text-xs text-muted-foreground">
                              <div className="font-medium mb-1">Functions:</div>
                              {stage.functions.map(fn => (
                                <code key={fn} className="block text-[10px] text-muted-foreground">{fn}</code>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Log Preview */}
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Log Preview</div>
                          <ScrollArea className="h-52 rounded border border-border bg-muted/30 p-2">
                            {(logs[stage.id] || []).length === 0 ? (
                              <div className="text-xs text-muted-foreground text-center py-8">
                                No logs yet. Run the stage.
                              </div>
                            ) : (
                              <div className="space-y-1 font-mono text-[10px]">
                                {(logs[stage.id] || []).map(log => (
                                  <div key={log.id} className="flex gap-2">
                                    <span className="text-muted-foreground shrink-0">
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={getLogLevelColor(log.level)}>
                                      [{log.level.toUpperCase()}]
                                    </span>
                                    <span className="text-foreground">{log.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Footer Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
          <div className="font-mono">Pass 0 Radar Pipeline • Waterfall v1.0</div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Newspaper className="h-3 w-3" />
              News: {stageStatuses.news_narratives.itemCount}
            </span>
            <span className="flex items-center gap-1">
              <FileCheck className="h-3 w-3" />
              Permits: {stageStatuses.permits_inspections.itemCount}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Pins: {stageStatuses.geo_pin_output.itemCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pass0Hub;
