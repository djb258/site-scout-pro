import { Lock, Cpu, Brain, DollarSign, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BARTON_TOOL_LEDGER, 
  LedgerStep, 
  getPipelineStats, 
  getToolTypeLabel,
  getToolTypeColor 
} from "@/config/barton-tool-ledger";

interface ToolGovernanceCardProps {
  passNumber: number | string;
}

function getPassKey(passNumber: number | string): keyof typeof BARTON_TOOL_LEDGER {
  if (passNumber === 1.5 || passNumber === "1.5" || passNumber === 15) return "pass15";
  if (passNumber === "cca") return "cca";
  return `pass${passNumber}` as keyof typeof BARTON_TOOL_LEDGER;
}

export function ToolGovernanceCard({ passNumber }: ToolGovernanceCardProps) {
  const passKey = getPassKey(passNumber);
  const steps = BARTON_TOOL_LEDGER[passKey];
  
  if (!steps) return null;
  
  const stats = getPipelineStats(steps);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Tool Governance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Doctrine Statement */}
        <div className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-3">
          "Deterministic First, LLM Tail Only"
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-lg font-semibold">{stats.deterministicPercent}%</div>
              <div className="text-xs text-muted-foreground">Deterministic</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-amber-400" />
            <div>
              <div className="text-lg font-semibold">{stats.llmCount}</div>
              <div className="text-xs text-muted-foreground">LLM Steps</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg font-semibold">{stats.locked}</div>
              <div className="text-xs text-muted-foreground">Locked Steps</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <div>
              <div className="text-lg font-semibold">${stats.totalCost.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Est. Cost</div>
            </div>
          </div>
        </div>

        {/* Step List */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tool Assignments
          </div>
          {steps.map((step: LedgerStep) => (
            <div 
              key={step.step} 
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-background/50"
            >
              <div className="flex items-center gap-2">
                {step.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                <span className="font-medium">{step.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{step.solution}</span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 ${getToolTypeColor(step.type)}`}
                >
                  {getToolTypeLabel(step.type)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
