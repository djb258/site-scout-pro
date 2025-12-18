import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Globe, 
  Map, 
  Target, 
  Play, 
  Power, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2,
  FileText,
  List,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface IntakeBay {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  scope: string;
  sources: string[];
}

interface BayStatus {
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

const INTAKE_BAYS: IntakeBay[] = [
  {
    id: 'national',
    label: 'National Feeds',
    description: 'Broad macro signals: national news, press releases, SEC filings',
    icon: Globe,
    scope: 'national',
    sources: ['press_releases', 'sec_filings', 'national_news']
  },
  {
    id: 'regional',
    label: 'State / County / Town',
    description: 'Geo-scoped signals: local permits, economic dev, municipal news',
    icon: Map,
    scope: 'regional',
    sources: ['local_gov_permits', 'economic_dev', 'bizjournals', 'google_news_local']
  },
  {
    id: 'asset',
    label: 'Asset-Targeted Feeds',
    description: 'Direct asset monitoring: competitor filings, RE transactions, site-specific',
    icon: Target,
    scope: 'asset',
    sources: ['competitor_filings', 're_transactions', 'site_monitors']
  }
];

// Mock log data
const generateMockLogs = (bayId: string): LogEntry[] => [
  { id: '1', timestamp: new Date().toISOString(), level: 'info', message: `[${bayId}] Intake cycle initiated` },
  { id: '2', timestamp: new Date(Date.now() - 1000).toISOString(), level: 'info', message: `[${bayId}] Fetching from 3 sources...` },
  { id: '3', timestamp: new Date(Date.now() - 2000).toISOString(), level: 'warn', message: `[${bayId}] Rate limit warning on source_2` },
  { id: '4', timestamp: new Date(Date.now() - 3000).toISOString(), level: 'info', message: `[${bayId}] Geo-resolution complete: 12 items` },
  { id: '5', timestamp: new Date(Date.now() - 4000).toISOString(), level: 'error', message: `[${bayId}] Failed to parse item #7 - malformed URL` },
  { id: '6', timestamp: new Date(Date.now() - 5000).toISOString(), level: 'info', message: `[${bayId}] Emitted 11 pins to scratch store` },
];

export default function Pass0Intake() {
  const [bayStatuses, setBayStatuses] = useState<Record<string, BayStatus>>(() => {
    const initial: Record<string, BayStatus> = {};
    INTAKE_BAYS.forEach(bay => {
      initial[bay.id] = {
        isRunning: false,
        lastRun: null,
        itemCount: 0,
        errorCount: 0,
        killSwitch: false
      };
    });
    return initial;
  });

  const [expandedBays, setExpandedBays] = useState<string[]>([]);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});

  // Auto-expand bays with active runs or errors
  useEffect(() => {
    const autoExpand: string[] = [];
    Object.entries(bayStatuses).forEach(([bayId, status]) => {
      if (status.isRunning || status.errorCount > 0) {
        autoExpand.push(bayId);
      }
    });
    if (autoExpand.length > 0) {
      setExpandedBays(prev => [...new Set([...prev, ...autoExpand])]);
    }
  }, [bayStatuses]);

  const logAction = async (bayId: string, action: string, metadata: object = {}) => {
    console.log(`[PASS0_INTAKE] Bay: ${bayId}, Action: ${action}`, metadata);
    
    // Log to pass0_run_log
    try {
      await supabase.from('pass0_run_log').insert({
        run_id: crypto.randomUUID(),
        step: `intake_${bayId}_${action}`,
        status: 'logged',
        started_at: new Date().toISOString(),
        metadata: { bay_id: bayId, action, ...metadata }
      });
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  };

  const toggleKillSwitch = async (bayId: string) => {
    const newValue = !bayStatuses[bayId].killSwitch;
    setBayStatuses(prev => ({
      ...prev,
      [bayId]: { ...prev[bayId], killSwitch: newValue }
    }));
    
    await logAction(bayId, 'kill_switch_toggle', { enabled: newValue });
    toast[newValue ? 'warning' : 'success'](
      newValue ? `Kill switch ENABLED for ${bayId}` : `Kill switch DISABLED for ${bayId}`
    );
  };

  const triggerManualRun = async (bayId: string) => {
    if (bayStatuses[bayId].killSwitch) {
      toast.error('Cannot run - kill switch is enabled');
      return;
    }

    setBayStatuses(prev => ({
      ...prev,
      [bayId]: { ...prev[bayId], isRunning: true }
    }));

    await logAction(bayId, 'manual_run_triggered');
    toast.info(`Starting ${bayId} intake run...`);

    // Simulate run with mock data
    setLogs(prev => ({ ...prev, [bayId]: generateMockLogs(bayId) }));

    // Call placeholder function
    try {
      const { data, error } = await supabase.functions.invoke('pass0_orchestrator', {
        body: { trigger: 'manual', bay_id: bayId, dry_run: true }
      });

      if (error) throw error;

      const mockItemCount = Math.floor(Math.random() * 20) + 5;
      const mockErrorCount = Math.floor(Math.random() * 3);

      setBayStatuses(prev => ({
        ...prev,
        [bayId]: {
          ...prev[bayId],
          isRunning: false,
          lastRun: new Date().toISOString(),
          itemCount: mockItemCount,
          errorCount: mockErrorCount
        }
      }));

      await logAction(bayId, 'manual_run_complete', { items: mockItemCount, errors: mockErrorCount });
      toast.success(`${bayId} run complete: ${mockItemCount} items, ${mockErrorCount} errors`);

    } catch (err) {
      setBayStatuses(prev => ({
        ...prev,
        [bayId]: { ...prev[bayId], isRunning: false, errorCount: prev[bayId].errorCount + 1 }
      }));
      toast.error(`Run failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getStatusIndicator = (status: BayStatus) => {
    if (status.killSwitch) {
      return <Badge variant="destructive" className="gap-1"><Power className="h-3 w-3" />KILLED</Badge>;
    }
    if (status.isRunning) {
      return <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-600"><Loader2 className="h-3 w-3 animate-spin" />RUNNING</Badge>;
    }
    if (status.errorCount > 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{status.errorCount} ERRORS</Badge>;
    }
    if (status.lastRun) {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />READY</Badge>;
    }
    return <Badge variant="outline" className="gap-1">IDLE</Badge>;
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Pass 0 — Macro Signals & Narrative Pins</h1>
                <p className="text-sm text-muted-foreground">Intake Control Surface • Cold-Start Execution Frame</p>
              </div>
            </div>
            <Link to="/pass0">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Card className="border-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              INTAKE BAYS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion 
              type="multiple" 
              value={expandedBays}
              onValueChange={setExpandedBays}
              className="divide-y"
            >
              {INTAKE_BAYS.map((bay) => {
                const status = bayStatuses[bay.id];
                const BayIcon = bay.icon;

                return (
                  <AccordionItem key={bay.id} value={bay.id} className="border-0">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${status.killSwitch ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                            <BayIcon className={`h-5 w-5 ${status.killSwitch ? 'text-destructive' : 'text-primary'}`} />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold">{bay.label}</div>
                            <div className="text-xs text-muted-foreground">{bay.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusIndicator(status)}
                          {status.lastRun && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(status.lastRun).toLocaleTimeString()}
                            </div>
                          )}
                          <div className="text-xs font-mono text-muted-foreground">
                            {status.itemCount} items
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-6 pb-6">
                      <div className="grid grid-cols-3 gap-6">
                        {/* Source Registry */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <List className="h-4 w-4" />
                            Source Registry
                          </div>
                          <div className="space-y-2">
                            {bay.sources.map(source => (
                              <div 
                                key={source} 
                                className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs"
                              >
                                <code>{source}</code>
                                <Badge variant="outline" className="text-[10px]">{bay.scope}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Controls</div>
                          <div className="space-y-4">
                            <Button 
                              onClick={() => triggerManualRun(bay.id)}
                              disabled={status.isRunning || status.killSwitch}
                              className="w-full"
                              variant={status.killSwitch ? 'secondary' : 'default'}
                            >
                              {status.isRunning ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
                              ) : (
                                <><Play className="h-4 w-4 mr-2" />Manual Run</>
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
                                onCheckedChange={() => toggleKillSwitch(bay.id)}
                                className="data-[state=checked]:bg-destructive"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="p-2 rounded bg-muted">
                                <div className="text-lg font-bold">{status.itemCount}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">Items</div>
                              </div>
                              <div className="p-2 rounded bg-muted">
                                <div className={`text-lg font-bold ${status.errorCount > 0 ? 'text-destructive' : ''}`}>
                                  {status.errorCount}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase">Errors</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Log Preview */}
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Log Preview</div>
                          <ScrollArea className="h-48 rounded border bg-muted/30 p-2">
                            {(logs[bay.id] || []).length === 0 ? (
                              <div className="text-xs text-muted-foreground text-center py-8">
                                No logs yet. Trigger a run.
                              </div>
                            ) : (
                              <div className="space-y-1 font-mono text-[10px]">
                                {(logs[bay.id] || []).map(log => (
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

        {/* Footer Status */}
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <div>Pass 0 Intake Control • Shell v0.1.0</div>
          <div className="flex items-center gap-4">
            <span>National: {bayStatuses.national.itemCount}</span>
            <span>Regional: {bayStatuses.regional.itemCount}</span>
            <span>Asset: {bayStatuses.asset.itemCount}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
