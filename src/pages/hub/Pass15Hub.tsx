import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineDocPanel } from "@/components/PipelineDocPanel";
import { ToolGovernanceCard } from "@/components/ToolGovernanceCard";
import { usePass15Dashboard, Pass15DashboardData } from "@/hooks/usePass15Dashboard";
import { 
  MapPin, 
  Search, 
  Globe, 
  Phone,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Zap,
  RefreshCw,
  AlertTriangle,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// 4-Tier Cost Ladder Configuration
const COST_TIERS = [
  {
    tier: 1,
    name: "OSM Discovery",
    shortName: "OSM",
    description: "OpenStreetMap facility discovery - zero cost baseline",
    icon: MapPin,
    cost: "Free",
    costValue: 0,
    bgClass: "bg-emerald-500/10 border-emerald-500/30",
    textClass: "text-emerald-400",
    confidence: "Low",
    speed: "Fast",
    dataPoints: ["Facility name", "Address", "Coordinates"],
    edgeFunction: "hub1_pass1_supply_osm",
  },
  {
    tier: 2,
    name: "AI Search",
    shortName: "AI Search",
    description: "Lovable AI-powered web search for pricing intelligence",
    icon: Search,
    cost: "$0.01/query",
    costValue: 1,
    bgClass: "bg-blue-500/10 border-blue-500/30",
    textClass: "text-blue-400",
    confidence: "Medium",
    speed: "Fast",
    dataPoints: ["Published rates", "Website URL", "Unit sizes"],
    edgeFunction: "hub15_competitor_search",
  },
  {
    tier: 3,
    name: "Web Scrape",
    shortName: "Scrape",
    description: "Direct website scraping for rate extraction",
    icon: Globe,
    cost: "Free",
    costValue: 0,
    bgClass: "bg-amber-500/10 border-amber-500/30",
    textClass: "text-amber-400",
    confidence: "High",
    speed: "Medium",
    dataPoints: ["Exact rates", "All unit sizes", "Specials/promos"],
    edgeFunction: "hub15_rate_scraper",
  },
  {
    tier: 4,
    name: "AI Voice Call",
    shortName: "AI Call",
    description: "Retell.ai automated phone calls for verification",
    icon: Phone,
    cost: "$0.15/call",
    costValue: 15,
    bgClass: "bg-rose-500/10 border-rose-500/30",
    textClass: "text-rose-400",
    confidence: "Verified",
    speed: "Slow",
    dataPoints: ["Verified rates", "Availability", "Move-in specials"],
    edgeFunction: "hub15_ai_caller",
  }
];

interface TierStats {
  attempted: number;
  success: number;
  cost: number;
}

function calculateTierStats(data: Pass15DashboardData | null): TierStats[] {
  if (!data) {
    return COST_TIERS.map(() => ({ attempted: 0, success: 0, cost: 0 }));
  }

  // Approximate distribution based on worker assignments
  const { queue_summary, cost_summary, performance } = data;
  
  return [
    // Tier 1: OSM (free, high volume)
    { 
      attempted: Math.floor(performance.total_attempts * 0.5), 
      success: Math.floor(performance.completed_count * 0.6), 
      cost: 0 
    },
    // Tier 2: AI Search
    { 
      attempted: queue_summary.by_worker.unassigned, 
      success: Math.floor(performance.completed_count * 0.25), 
      cost: cost_summary.by_worker.scraper_cents / 100 
    },
    // Tier 3: Scraper
    { 
      attempted: queue_summary.by_worker.scraper, 
      success: Math.floor(performance.completed_count * 0.10), 
      cost: 0 
    },
    // Tier 4: AI Caller
    { 
      attempted: queue_summary.by_worker.ai_caller, 
      success: Math.floor(performance.completed_count * 0.05), 
      cost: cost_summary.by_worker.ai_caller_cents / 100 
    },
  ];
}

function TierCard({ tier, stats }: { tier: typeof COST_TIERS[0]; stats: TierStats }) {
  const Icon = tier.icon;
  const successRate = stats.attempted > 0 ? Math.round((stats.success / stats.attempted) * 100) : 0;
  
  return (
    <Card className={`relative overflow-hidden border ${tier.bgClass}`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${tier.textClass.replace('text-', 'bg-')}`} />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${tier.bgClass}`}>
              <Icon className={`w-5 h-5 ${tier.textClass}`} />
            </div>
            <div>
              <CardTitle className="text-base">{tier.name}</CardTitle>
              <CardDescription className="text-xs">Tier {tier.tier}</CardDescription>
            </div>
          </div>
          <Badge variant="default" className="text-xs">Active</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tier.description}</p>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className={tier.textClass}>{tier.cost}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{tier.speed}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded p-2">
            <div className="text-lg font-semibold">{stats.attempted}</div>
            <div className="text-xs text-muted-foreground">Attempted</div>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <div className="text-lg font-semibold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Success</div>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <div className="text-lg font-semibold">${stats.cost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Cost</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Confidence Level</span>
          <Badge variant="outline" className={tier.textClass}>{tier.confidence}</Badge>
        </div>
        
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Data Points Collected:</span>
          <div className="flex flex-wrap gap-1">
            {tier.dataPoints.map((point) => (
              <Badge key={point} variant="secondary" className="text-xs">
                {point}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="pt-2 border-t border-border">
          <code className="text-xs text-muted-foreground font-mono">{tier.edgeFunction}</code>
        </div>
      </CardContent>
    </Card>
  );
}

function CostLadderFlow() {
  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Cost Ladder Progression
        </CardTitle>
        <CardDescription>
          Each tier escalates only when previous tier fails to gather sufficient data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          {COST_TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <div key={tier.tier} className="flex items-center gap-2 flex-1">
                <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${tier.bgClass} flex-1`}>
                  <Icon className={`w-6 h-6 ${tier.textClass}`} />
                  <span className="text-xs font-medium">{tier.shortName}</span>
                  <span className={`text-xs ${tier.textClass}`}>{tier.cost}</span>
                </div>
                {index < COST_TIERS.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Free</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Low Cost</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Medium Cost</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span>High Cost</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueStatusCard({ data, isLoading }: { data: Pass15DashboardData | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const queue = data?.queue_summary || { 
    total: 0, 
    by_status: { pending: 0, in_progress: 0, resolved: 0, failed: 0, killed: 0 } 
  };
  const total = queue.total || 1;
  const completedPercent = Math.round((queue.by_status.resolved / total) * 100) || 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gap Queue Status</CardTitle>
        <CardDescription>Current rate verification queue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xl font-semibold">{queue.by_status.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xl font-semibold">{queue.by_status.in_progress}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="text-xl font-semibold">{queue.by_status.resolved}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <div>
              <div className="text-xl font-semibold">{queue.by_status.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{completedPercent}%</span>
          </div>
          <Progress value={completedPercent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

function GuardRailCard({ data, isLoading }: { data: Pass15DashboardData | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  const guard = data?.guard_rail_status;
  if (!guard) return null;

  const healthColors = {
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    yellow: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    red: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  return (
    <Card className={`border ${healthColors[guard.health]}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Guard Rails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {guard.kill_switch_active && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">Kill Switch Active</span>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Daily Cost Cap</div>
            <Progress value={guard.cost_cap_used_percent} className="h-2" />
            <div className="text-xs mt-1">${(guard.cost_cap_remaining_cents / 100).toFixed(2)} remaining</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Daily Call Limit</div>
            <Progress value={guard.daily_calls_used_percent} className="h-2" />
            <div className="text-xs mt-1">{guard.daily_calls_remaining} calls remaining</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Failure Rate</span>
          <Badge variant={guard.failure_rate_breach ? "destructive" : "secondary"}>
            {(guard.failure_rate * 100).toFixed(1)}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function CostSummaryCard({ data, isLoading }: { data: Pass15DashboardData | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const cost = data?.cost_summary || { total_cents: 0, today_cents: 0, by_worker: { scraper_cents: 0, ai_caller_cents: 0 } };
  const performance = data?.performance || { total_attempts: 0, avg_cost_cents: 0 };
  const totalCost = cost.total_cents / 100;
  const todayCost = cost.today_cents / 100;
  const avgCost = performance.avg_cost_cents / 100;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Cost Summary
        </CardTitle>
        <CardDescription>Total spend across all tiers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary">${totalCost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total Spend</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">${todayCost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">${avgCost.toFixed(3)}</div>
            <div className="text-xs text-muted-foreground">Avg/Attempt</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs w-24 text-blue-400">AI Search</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-400"
                style={{ width: `${totalCost > 0 ? (cost.by_worker.scraper_cents / cost.total_cents) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">
              ${(cost.by_worker.scraper_cents / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-24 text-rose-400">AI Caller</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-400"
                style={{ width: `${totalCost > 0 ? (cost.by_worker.ai_caller_cents / cost.total_cents) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">
              ${(cost.by_worker.ai_caller_cents / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Pass15Hub() {
  const { data, isLoading, error, lastUpdated } = usePass15Dashboard(30000);
  const tierStats = calculateTierStats(data);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pass 1.5 — Rent Recon Hub</h1>
          <p className="text-muted-foreground mt-1">
            Rate evidence collection with 4-tier cost escalation ladder
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {lastUpdated && (
            <span>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Kill Switch Banner */}
      {data?.guard_rail_status?.kill_switch_active && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div>
              <div className="font-semibold text-destructive">Kill Switch Active</div>
              <div className="text-sm text-destructive/80">
                Processing halted due to guard rail breach. Check failure rate or cost limits.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Ladder Flow */}
      <CostLadderFlow />

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <QueueStatusCard data={data} isLoading={isLoading} />
        <CostSummaryCard data={data} isLoading={isLoading} />
        <GuardRailCard data={data} isLoading={isLoading} />
      </div>

      {/* Tier Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Collection Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COST_TIERS.map((tier, index) => (
            <TierCard key={tier.tier} tier={tier} stats={tierStats[index]} />
          ))}
        </div>
      </div>

      {/* Pipeline Documentation & Governance */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <PipelineDocPanel passNumber={1.5} />
        </div>
        <div className="col-span-4">
          <ToolGovernanceCard passNumber={1.5} />
        </div>
      </div>
    </div>
  );
}
