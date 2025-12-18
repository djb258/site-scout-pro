import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Play, RefreshCw, MapPin, Newspaper, AlertCircle, CheckCircle, Clock, XCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import sourceRegistry from '@/config/pass0-source-registry.json';

interface RunLog {
  id: string;
  run_id: string;
  step: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  item_count: number;
  failure_count: number;
  kill_switch: boolean;
  error_message: string | null;
  created_at: string;
}

interface NarrativePin {
  id: string;
  run_id: string;
  source_id: string;
  raw_title: string;
  raw_url: string | null;
  lat: number | null;
  lon: number | null;
  zip_id: string | null;
  confidence: string;
  resolution_tier: string;
  created_at: string;
}

interface SourceConfig {
  source_id: string;
  type: string;
  geo_scope: string;
  enabled: boolean;
  cadence: string;
  description: string;
}

export default function Pass0Dashboard() {
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [pins, setPins] = useState<NarrativePin[]>([]);
  const [sources, setSources] = useState<SourceConfig[]>(sourceRegistry.sources);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch run logs
    const { data: logData } = await supabase
      .from('pass0_run_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (logData) setRunLogs(logData);

    // Fetch pins
    const { data: pinData } = await supabase
      .from('pass0_narrative_pins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (pinData) setPins(pinData);
    
    setLoading(false);
  };

  const runOrchestrator = async (dryRun = false) => {
    setIsRunning(true);
    toast.info('Starting Pass 0 orchestrator...');

    try {
      const { data, error } = await supabase.functions.invoke('pass0_orchestrator', {
        body: { trigger: 'manual', dry_run: dryRun }
      });

      if (error) throw error;

      toast.success(`Run complete: ${data.summary?.success}/${data.summary?.total} steps succeeded`);
      fetchData();
    } catch (err) {
      toast.error(`Run failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleSource = (sourceId: string) => {
    setSources(prev => prev.map(s => 
      s.source_id === sourceId ? { ...s, enabled: !s.enabled } : s
    ));
    toast.info(`Source ${sourceId} toggled (UI only - not persisted)`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running': return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'failure': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high': return <Badge variant="default" className="bg-green-600">High</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  // Group runs by run_id
  const groupedRuns = runLogs.reduce((acc, log) => {
    if (!acc[log.run_id]) acc[log.run_id] = [];
    acc[log.run_id].push(log);
    return acc;
  }, {} as Record<string, RunLog[]>);

  // Group pins by ZIP
  const pinsByZip = pins.reduce((acc, pin) => {
    const zip = pin.zip_id || 'unmapped';
    if (!acc[zip]) acc[zip] = [];
    acc[zip].push(pin);
    return acc;
  }, {} as Record<string, NarrativePin[]>);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Newspaper className="h-8 w-8 text-primary" />
              Pass 0: News & Narrative Pins
            </h1>
            <p className="text-muted-foreground mt-1">
              Cold-start execution frame for narrative signal aggregation
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/pass0/intake">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Intake Control
              </Button>
            </Link>
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => runOrchestrator(true)} disabled={isRunning} variant="secondary">
              <Play className="h-4 w-4 mr-2" />
              Dry Run
            </Button>
            <Button onClick={() => runOrchestrator(false)} disabled={isRunning}>
              <Play className="h-4 w-4 mr-2" />
              Run Orchestrator
            </Button>
          </div>
        </div>

        {/* Source Registry */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Source Registry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map(source => (
                <div 
                  key={source.source_id} 
                  className={`p-4 rounded-lg border ${source.enabled ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/50'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium">{source.source_id}</span>
                    <Switch 
                      checked={source.enabled} 
                      onCheckedChange={() => toggleSource(source.source_id)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{source.description}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{source.type}</Badge>
                    <Badge variant="outline">{source.geo_scope}</Badge>
                    <Badge variant="outline">{source.cadence}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Run History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(groupedRuns).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No runs yet. Click "Run Orchestrator" to start.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(groupedRuns).slice(0, 5).map(([runId, steps]) => (
                    <div key={runId} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-xs font-mono">{runId.slice(0, 8)}...</code>
                        <span className="text-xs text-muted-foreground">
                          {steps[0]?.created_at ? new Date(steps[0].created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {['source_fetcher', 'geo_resolver', 'zip_mapper', 'pin_emitter'].map(step => {
                          const stepLog = steps.find(s => s.step === step);
                          return (
                            <div key={step} className="text-center">
                              <div className="flex justify-center mb-1">
                                {stepLog ? getStatusIcon(stepLog.status) : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                              </div>
                              <div className="text-xs truncate">{step.replace('_', ' ')}</div>
                              {stepLog && <div className="text-xs text-muted-foreground">{stepLog.item_count} items</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pins by ZIP (Map Placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Narrative Pins by ZIP
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(pinsByZip).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mb-2 opacity-50" />
                  <p>No pins yet. Run the orchestrator to generate pins.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(pinsByZip).map(([zip, zipPins]) => (
                    <div key={zip} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-medium">{zip === 'unmapped' ? 'Unmapped' : `ZIP ${zip}`}</span>
                        <Badge>{zipPins.length} pins</Badge>
                      </div>
                      <div className="space-y-1">
                        {zipPins.slice(0, 3).map(pin => (
                          <div key={pin.id} className="text-xs flex items-start gap-2">
                            {getConfidenceBadge(pin.confidence)}
                            <span className="truncate flex-1">{pin.raw_title}</span>
                          </div>
                        ))}
                        {zipPins.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{zipPins.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Pins Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Narrative Pins</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No pins generated yet
                    </TableCell>
                  </TableRow>
                ) : (
                  pins.slice(0, 20).map(pin => (
                    <TableRow key={pin.id}>
                      <TableCell className="max-w-xs truncate">{pin.raw_title}</TableCell>
                      <TableCell><code className="text-xs">{pin.source_id}</code></TableCell>
                      <TableCell>{pin.zip_id || '-'}</TableCell>
                      <TableCell>{getConfidenceBadge(pin.confidence)}</TableCell>
                      <TableCell><Badge variant="outline">{pin.resolution_tier}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(pin.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
