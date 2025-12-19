import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PipelineDocPanel } from "@/components/PipelineDocPanel";
import { ToolGovernanceCard } from "@/components/ToolGovernanceCard";
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
  Zap
} from "lucide-react";

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
    color: "hsl(var(--chart-1))",
    bgClass: "bg-emerald-500/10 border-emerald-500/30",
    textClass: "text-emerald-400",
    confidence: "Low",
    speed: "Fast",
    dataPoints: ["Facility name", "Address", "Coordinates"],
    edgeFunction: "hub1_pass1_supply_osm",
    status: "active"
  },
  {
    tier: 2,
    name: "AI Search",
    shortName: "AI Search",
    description: "Lovable AI-powered web search for pricing intelligence",
    icon: Search,
    cost: "$0.002/query",
    costValue: 0.002,
    color: "hsl(var(--chart-2))",
    bgClass: "bg-blue-500/10 border-blue-500/30",
    textClass: "text-blue-400",
    confidence: "Medium",
    speed: "Fast",
    dataPoints: ["Published rates", "Website URL", "Unit sizes"],
    edgeFunction: "hub15_competitor_search",
    status: "active"
  },
  {
    tier: 3,
    name: "Web Scrape",
    shortName: "Scrape",
    description: "Firecrawl-powered direct website scraping",
    icon: Globe,
    cost: "$0.01/page",
    costValue: 0.01,
    color: "hsl(var(--chart-3))",
    bgClass: "bg-amber-500/10 border-amber-500/30",
    textClass: "text-amber-400",
    confidence: "High",
    speed: "Medium",
    dataPoints: ["Exact rates", "All unit sizes", "Specials/promos"],
    edgeFunction: "hub15_rate_scraper",
    status: "shell"
  },
  {
    tier: 4,
    name: "AI Voice Call",
    shortName: "AI Call",
    description: "Retell.ai automated phone calls for verification",
    icon: Phone,
    cost: "$0.15/call",
    costValue: 0.15,
    color: "hsl(var(--chart-4))",
    bgClass: "bg-rose-500/10 border-rose-500/30",
    textClass: "text-rose-400",
    confidence: "Verified",
    speed: "Slow",
    dataPoints: ["Verified rates", "Availability", "Move-in specials"],
    edgeFunction: "hub15_ai_caller",
    status: "shell"
  }
];

// Mock data for demonstration
const MOCK_QUEUE_STATS = {
  pending: 12,
  inProgress: 3,
  completed: 45,
  failed: 2
};

const MOCK_TIER_STATS = [
  { tier: 1, attempted: 60, success: 58, cost: 0 },
  { tier: 2, attempted: 45, success: 42, cost: 0.09 },
  { tier: 3, attempted: 15, success: 12, cost: 0.15 },
  { tier: 4, attempted: 5, success: 4, cost: 0.75 }
];

function TierCard({ tier, stats }: { tier: typeof COST_TIERS[0]; stats: typeof MOCK_TIER_STATS[0] }) {
  const Icon = tier.icon;
  const successRate = stats.attempted > 0 ? Math.round((stats.success / stats.attempted) * 100) : 0;
  
  return (
    <Card className={`relative overflow-hidden border ${tier.bgClass}`}>
      {/* Tier indicator */}
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
          <Badge 
            variant={tier.status === "active" ? "default" : "secondary"}
            className="text-xs"
          >
            {tier.status === "active" ? "Active" : "Shell"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tier.description}</p>
        
        {/* Cost & Speed */}
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
        
        {/* Stats */}
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
        
        {/* Confidence */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Confidence Level</span>
          <Badge variant="outline" className={tier.textClass}>{tier.confidence}</Badge>
        </div>
        
        {/* Data Points */}
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
        
        {/* Edge Function */}
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
        
        {/* Legend */}
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

function QueueStatusCard() {
  const total = MOCK_QUEUE_STATS.pending + MOCK_QUEUE_STATS.inProgress + MOCK_QUEUE_STATS.completed + MOCK_QUEUE_STATS.failed;
  const completedPercent = Math.round((MOCK_QUEUE_STATS.completed / total) * 100);
  
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
              <div className="text-xl font-semibold">{MOCK_QUEUE_STATS.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xl font-semibold">{MOCK_QUEUE_STATS.inProgress}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="text-xl font-semibold">{MOCK_QUEUE_STATS.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <div>
              <div className="text-xl font-semibold">{MOCK_QUEUE_STATS.failed}</div>
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

function CostSummaryCard() {
  const totalCost = MOCK_TIER_STATS.reduce((sum, t) => sum + t.cost, 0);
  const totalAttempts = MOCK_TIER_STATS.reduce((sum, t) => sum + t.attempted, 0);
  const avgCostPerAttempt = totalAttempts > 0 ? totalCost / totalAttempts : 0;
  
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
            <div className="text-2xl font-bold">{totalAttempts}</div>
            <div className="text-xs text-muted-foreground">Total Attempts</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">${avgCostPerAttempt.toFixed(3)}</div>
            <div className="text-xs text-muted-foreground">Avg/Attempt</div>
          </div>
        </div>
        
        {/* Cost breakdown by tier */}
        <div className="space-y-2">
          {COST_TIERS.map((tier, index) => {
            const stats = MOCK_TIER_STATS[index];
            const tierPercent = totalCost > 0 ? (stats.cost / totalCost) * 100 : 0;
            return (
              <div key={tier.tier} className="flex items-center gap-2">
                <span className={`text-xs w-20 ${tier.textClass}`}>{tier.shortName}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${tier.textClass.replace('text-', 'bg-')}`}
                    style={{ width: `${tierPercent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  ${stats.cost.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Pass15Hub() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pass 1.5 — Rent Recon Hub</h1>
        <p className="text-muted-foreground mt-1">
          Rate evidence collection with 4-tier cost escalation ladder
        </p>
      </div>

      {/* Cost Ladder Flow */}
      <CostLadderFlow />

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QueueStatusCard />
        <CostSummaryCard />
      </div>

      {/* Tier Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Collection Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COST_TIERS.map((tier, index) => (
            <TierCard key={tier.tier} tier={tier} stats={MOCK_TIER_STATS[index]} />
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
