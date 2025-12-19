import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { 
  Radio, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Newspaper, 
  FileCheck, 
  MapPin, 
  Power,
  Loader2,
  Activity,
  FileText,
  Inbox,
  RefreshCw
} from "lucide-react";

interface StageStatus {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'killed' | 'error';
  last_run: string | null;
  item_count: number;
  error_count: number;
  kill_switch: boolean;
}

interface Pass0Status {
  last_run: string | null;
  throttle_state: 'normal' | 'throttled' | 'paused';
  kill_switch_active: boolean;
  audit_log_count: number;
  queue_depth: number;
  stages: StageStatus[];
  recent_events: Array<{
    action: string;
    status: string;
    timestamp: string;
  }>;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

export const Pass0StatusPanel = () => {
  const [status, setStatus] = useState<Pass0Status | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('hub0_get_status');
      
      if (fnError) throw fnError;
      
      setStatus(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[Pass0StatusPanel] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStageIcon = (stageId: string) => {
    switch (stageId) {
      case 'news_narratives': return <Newspaper className="h-4 w-4" />;
      case 'permits_inspections': return <FileCheck className="h-4 w-4" />;
      case 'geo_pin_output': return <MapPin className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (stage: StageStatus) => {
    if (stage.kill_switch) {
      return <Badge variant="destructive" className="gap-1"><Power className="h-3 w-3" />KILLED</Badge>;
    }
    if (stage.status === 'running') {
      return <Badge className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30"><Loader2 className="h-3 w-3 animate-spin" />RUNNING</Badge>;
    }
    if (stage.status === 'error' || stage.error_count > 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />ERROR</Badge>;
    }
    if (stage.last_run) {
      return <Badge className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3" />READY</Badge>;
    }
    return <Badge variant="outline" className="gap-1">IDLE</Badge>;
  };

  const getThrottleBadge = (state: string) => {
    switch (state) {
      case 'throttled':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">THROTTLED</Badge>;
      case 'paused':
        return <Badge variant="destructive">PAUSED</Badge>;
      default:
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">NORMAL</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-500" />
            Pass 0 Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-500" />
            Pass 0 Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50">
      {/* Kill Switch Banner */}
      {status?.kill_switch_active && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-6 py-3">
          <div className="flex items-center gap-2 text-destructive">
            <Power className="h-5 w-5" />
            <span className="font-semibold">KILL SWITCH ACTIVE</span>
            <span className="text-sm text-destructive/80">— One or more stages halted by backend</span>
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-500" />
            Pass 0 Status
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Updated {formatRelativeTime(lastRefresh.toISOString())}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Status Indicators */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              Last Run
            </div>
            <div className="font-mono text-sm">
              {formatRelativeTime(status?.last_run ?? null)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3 w-3" />
              Throttle
            </div>
            <div className="mt-1">
              {getThrottleBadge(status?.throttle_state ?? 'normal')}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FileText className="h-3 w-3" />
              Audit Logs
            </div>
            <div className="font-mono text-sm">
              {status?.audit_log_count ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Inbox className="h-3 w-3" />
              Queue Depth
            </div>
            <div className="font-mono text-sm">
              {status?.queue_depth ?? 0} pending
            </div>
          </div>
        </div>

        {/* Stage Status Cards */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Pipeline Stages</h4>
          <div className="space-y-2">
            {status?.stages.map((stage, index) => (
              <div 
                key={stage.id}
                className={`
                  p-4 rounded-lg border
                  ${stage.kill_switch 
                    ? 'bg-destructive/5 border-destructive/30' 
                    : 'bg-muted/30 border-border'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${stage.kill_switch ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}
                    `}>
                      {index + 1}
                    </div>
                    <div className={`p-2 rounded-lg ${stage.kill_switch ? 'bg-destructive/10' : 'bg-muted'}`}>
                      {getStageIcon(stage.id)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{stage.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(stage.last_run)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(stage)}
                    <div className="text-xs font-mono text-muted-foreground">
                      {stage.item_count} items
                    </div>
                    {stage.error_count > 0 && (
                      <div className="text-xs font-mono text-destructive">
                        {stage.error_count} errors
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Events */}
        {status?.recent_events && status.recent_events.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Recent Events</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {status.recent_events.slice(0, 5).map((event, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <span className="text-muted-foreground font-mono">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                  <Badge variant="outline" className="text-xs py-0">
                    {event.action}
                  </Badge>
                  <span className={event.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
