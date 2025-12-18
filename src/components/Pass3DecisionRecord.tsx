import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, XCircle, FileJson, History } from "lucide-react";

interface DecisionRecord {
  pass3_run_id: string;
  artifact_id: string;
  zip: string;
  decision: 'GO' | 'HOLD' | 'NO_GO';
  phase_scope: string;
  timing_intent: string;
  confidence_class: string;
  rationale: string;
  lifecycle_status: string;
  created_at: string;
  payload_for_neon: object;
}

interface PreviousDecision {
  run_id: string;
  decision: string;
  created_at: string;
  status: string;
}

interface Pass3DecisionRecordProps {
  decision: DecisionRecord | null;
  previousDecisions: PreviousDecision[];
}

const DecisionIcon = ({ decision }: { decision: string }) => {
  switch (decision) {
    case 'GO':
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    case 'HOLD':
      return <Clock className="h-6 w-6 text-amber-500" />;
    case 'NO_GO':
      return <XCircle className="h-6 w-6 text-red-500" />;
    default:
      return null;
  }
};

const DecisionBadge = ({ decision }: { decision: string }) => {
  const variant = decision === 'GO' ? 'default' : decision === 'HOLD' ? 'secondary' : 'destructive';
  return <Badge variant={variant}>{decision.replace('_', '-')}</Badge>;
};

export function Pass3DecisionRecord({ decision, previousDecisions }: Pass3DecisionRecordProps) {
  if (!decision) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No decision recorded yet</p>
          <p className="text-sm">Complete the form to record a decision</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Decision */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DecisionIcon decision={decision.decision} />
              <CardTitle className="text-lg">Decision Recorded</CardTitle>
            </div>
            <DecisionBadge decision={decision.decision} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Run ID</p>
              <code className="text-xs">{decision.pass3_run_id.slice(0, 16)}...</code>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">ZIP</p>
              <p className="font-medium">{decision.zip}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Lifecycle</p>
              <Badge variant="outline">{decision.lifecycle_status}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Created</p>
              <p className="text-xs">{new Date(decision.created_at).toLocaleString()}</p>
            </div>
          </div>

          <Separator />

          {/* Decision Parameters */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Phase Scope</p>
              <p className="font-medium">{decision.phase_scope.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Timing Intent</p>
              <p className="font-medium">{decision.timing_intent.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Confidence</p>
              <Badge 
                variant={
                  decision.confidence_class === 'HIGH' ? 'default' :
                  decision.confidence_class === 'MEDIUM' ? 'secondary' : 'outline'
                }
              >
                {decision.confidence_class}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Rationale */}
          <div>
            <p className="text-muted-foreground text-xs mb-1">Rationale</p>
            <p className="text-sm bg-muted/50 p-3 rounded-md">{decision.rationale}</p>
          </div>

          <Separator />

          {/* Neon Payload Preview */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Neon Payload (ready for persistence)</p>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-40">
              {JSON.stringify(decision.payload_for_neon, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Previous Decisions */}
      {previousDecisions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Previous Decisions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {previousDecisions.map((pd) => (
                <div 
                  key={pd.run_id} 
                  className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded"
                >
                  <div className="flex items-center gap-2">
                    <DecisionBadge decision={pd.decision} />
                    <code className="text-xs">{pd.run_id.slice(0, 12)}...</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{pd.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(pd.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
