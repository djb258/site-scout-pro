import { useProductionReadiness, ChecklistItem } from '@/hooks/useProductionReadiness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Clock,
  Shield,
  AlertCircle
} from 'lucide-react';

function StatusIcon({ status }: { status: ChecklistItem['status'] }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function PassBadge({ pass }: { pass: number }) {
  const label = pass === 15 ? 'Pass 1.5' : `Pass ${pass}`;
  const colors: Record<number, string> = {
    0: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    15: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    2: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    3: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[pass] || 'bg-muted text-muted-foreground'}`}>
      {label}
    </span>
  );
}

function ChecklistItemRow({ item }: { item: ChecklistItem }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={item.status} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{item.name}</span>
            <PassBadge pass={item.pass} />
          </div>
          {item.message && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>
          )}
        </div>
      </div>
      <Badge variant={item.status === 'pass' ? 'default' : item.status === 'fail' ? 'destructive' : 'secondary'}>
        {item.status.toUpperCase()}
      </Badge>
    </div>
  );
}

export function ProductionReadinessPanel() {
  const { 
    isReady, 
    blockingCount, 
    highPriorityCount, 
    warningCount,
    items, 
    loading, 
    lastUpdated,
    refresh 
  } = useProductionReadiness();

  const blockingItems = items.filter(i => i.category === 'blocking');
  const highPriorityItems = items.filter(i => i.category === 'high_priority');
  const warningItems = items.filter(i => i.category === 'warning');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle className="text-lg">Production Readiness</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Last checked: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Banner */}
        <Alert variant={isReady ? 'default' : 'destructive'}>
          {isReady ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle className="font-bold">
            Production Ready: {isReady ? 'YES ✅' : 'NO ❌'}
          </AlertTitle>
          <AlertDescription>
            {isReady ? (
              'All blocking items pass. System is ready for production.'
            ) : (
              `${blockingCount} blocking issue(s), ${highPriorityCount} high priority, ${warningCount} warning(s)`
            )}
          </AlertDescription>
        </Alert>

        {/* Blocking Items */}
        <div>
          <h3 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            BLOCKING ({blockingItems.filter(i => i.status === 'fail').length}/{blockingItems.length})
          </h3>
          <div className="bg-muted/30 rounded-lg p-3">
            {blockingItems.map(item => (
              <ChecklistItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* High Priority Items */}
        <div>
          <h3 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            HIGH PRIORITY ({highPriorityItems.filter(i => i.status === 'fail').length}/{highPriorityItems.length})
          </h3>
          <div className="bg-muted/30 rounded-lg p-3">
            {highPriorityItems.map(item => (
              <ChecklistItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Warning Items */}
        <div>
          <h3 className="text-sm font-semibold text-yellow-600 mb-2 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            WARNINGS ({warningItems.filter(i => i.status !== 'pass').length}/{warningItems.length})
          </h3>
          <div className="bg-muted/30 rounded-lg p-3">
            {warningItems.map(item => (
              <ChecklistItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
