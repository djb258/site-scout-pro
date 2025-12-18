import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";

interface SolverDecisionGatesProps {
  outputs: {
    total_rentable_sf: number;
    total_unit_count: number;
    building_count: number;
    utilization_pct?: number;
    phase1_viable: boolean;
  };
  blocked: boolean;
  blockedReason: string | null;
  warnings: string[];
}

interface Gate {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export const SolverDecisionGates = ({ outputs, blocked, blockedReason, warnings }: SolverDecisionGatesProps) => {
  // Compute gates based on outputs
  const gates: Gate[] = [
    {
      id: 'not_blocked',
      label: 'Calculation Passed',
      passed: !blocked,
      detail: blocked ? blockedReason || 'Blocked' : 'No blockers',
    },
    {
      id: 'has_capacity',
      label: 'Capacity > 0',
      passed: outputs.total_rentable_sf > 0 && outputs.total_unit_count > 0,
      detail: `${outputs.total_rentable_sf.toLocaleString()} SF / ${outputs.total_unit_count} units`,
    },
    {
      id: 'phase1_ok',
      label: 'Phase-1 Viable',
      passed: outputs.phase1_viable,
      detail: outputs.phase1_viable ? 'First phase pencils' : 'Phase-1 does not pencil',
    },
    {
      id: 'min_units',
      label: 'Min Unit Threshold',
      passed: outputs.total_unit_count >= 50,
      detail: outputs.total_unit_count >= 50 ? '≥50 units' : `Only ${outputs.total_unit_count} units`,
    },
    {
      id: 'min_buildings',
      label: 'Min Building Count',
      passed: outputs.building_count >= 1,
      detail: `${outputs.building_count} building(s)`,
    },
  ];

  const passedCount = gates.filter(g => g.passed).length;
  const allPassed = passedCount === gates.length;
  const hasWarnings = warnings.length > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Eligibility Gates
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {passedCount}/{gates.length} passed
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {gates.map((gate) => (
          <div key={gate.id} className="flex items-start gap-2 text-sm">
            {gate.passed ? (
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p className={gate.passed ? 'text-foreground' : 'text-destructive font-medium'}>
                {gate.label}
              </p>
              {gate.detail && (
                <p className="text-xs text-muted-foreground">{gate.detail}</p>
              )}
            </div>
          </div>
        ))}

        {/* Warnings Summary */}
        {hasWarnings && (
          <div className="pt-2 border-t mt-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">{warnings.length} Warning(s)</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {warnings.slice(0, 3).map((w, i) => (
                <li key={i} className="truncate">• {w}</li>
              ))}
              {warnings.length > 3 && (
                <li className="text-muted-foreground">+{warnings.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Overall Status */}
        <div className={`mt-3 p-2 rounded text-xs font-medium text-center ${
          allPassed && !hasWarnings
            ? 'bg-green-500/20 text-green-700 dark:text-green-300'
            : allPassed && hasWarnings
            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
            : 'bg-destructive/20 text-destructive'
        }`}>
          {allPassed && !hasWarnings && 'ELIGIBLE FOR GO'}
          {allPassed && hasWarnings && 'ELIGIBLE WITH CAVEATS'}
          {!allPassed && 'NOT ELIGIBLE'}
        </div>
      </CardContent>
    </Card>
  );
};
