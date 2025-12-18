import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck2, Clock, AlertCircle } from "lucide-react";

type DecisionType = 'GO' | 'HOLD' | 'NO_GO';
type ScopeType = 'PHASE_1' | 'FULL_BUILD' | 'PARTIAL';
type TimingType = 'IMMEDIATE' | 'CONTINGENT' | 'DEFERRED';
type ConfidenceType = 'HIGH' | 'MEDIUM' | 'LOW';

interface DecisionRecord {
  decision_id: string;
  solver_artifact_id: string;
  decision: DecisionType;
  scope: ScopeType;
  timing: TimingType;
  confidence: ConfidenceType;
  rationale: string;
  committed_at: string;
}

interface SolverDecisionOutputProps {
  record: DecisionRecord | null;
  isPending: boolean;
}

const SCOPE_LABELS: Record<ScopeType, string> = {
  PHASE_1: 'Phase 1',
  FULL_BUILD: 'Full Build',
  PARTIAL: 'Partial',
};

const TIMING_LABELS: Record<TimingType, string> = {
  IMMEDIATE: 'Immediate',
  CONTINGENT: 'Contingent',
  DEFERRED: 'Deferred',
};

export const SolverDecisionOutput = ({ record, isPending }: SolverDecisionOutputProps) => {
  if (isPending) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
            Decision Output
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Awaiting decision...
        </CardContent>
      </Card>
    );
  }

  if (!record) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Decision Output
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          No decision recorded
        </CardContent>
      </Card>
    );
  }

  const decisionColor = {
    GO: 'bg-green-500 text-white',
    HOLD: 'bg-amber-500 text-white',
    NO_GO: 'bg-destructive text-destructive-foreground',
  }[record.decision];

  const confidenceColor = {
    HIGH: 'bg-green-500/20 text-green-700 dark:text-green-300',
    MEDIUM: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    LOW: 'bg-destructive/20 text-destructive',
  }[record.confidence];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-green-500" />
          Decision Recorded
        </CardTitle>
        <p className="text-xs text-muted-foreground font-mono">{record.decision_id}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Decision Badge */}
        <div className="text-center">
          <Badge className={`text-lg px-4 py-1 ${decisionColor}`}>
            {record.decision.replace('_', '-')}
          </Badge>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Scope</p>
            <p className="font-medium">{SCOPE_LABELS[record.scope]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Timing</p>
            <p className="font-medium">{TIMING_LABELS[record.timing]}</p>
          </div>
        </div>

        {/* Confidence */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Confidence</p>
          <Badge variant="outline" className={`text-xs ${confidenceColor}`}>
            {record.confidence}
          </Badge>
        </div>

        {/* Rationale */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-1">Rationale</p>
          <p className="text-xs text-foreground">{record.rationale}</p>
        </div>

        {/* Timestamp */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Committed: {new Date(record.committed_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
};
