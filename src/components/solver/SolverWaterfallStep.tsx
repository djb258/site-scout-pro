import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info } from "lucide-react";

interface CalculationStep {
  step_number: number;
  step_name: string;
  formula: string;
  substituted: string;
  result_value: number;
  result_unit: string;
  why_note: string;
  warnings: string[];
}

interface SolverWaterfallStepProps {
  step: CalculationStep;
}

export const SolverWaterfallStep = ({ step }: SolverWaterfallStepProps) => {
  const hasWarnings = step.warnings.length > 0;

  return (
    <Card className={`${hasWarnings ? 'border-warning/50' : ''}`}>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Step {step.step_number}
            </Badge>
            <span className="font-medium text-sm">{step.step_name}</span>
          </div>
          {hasWarnings && (
            <AlertTriangle className="h-4 w-4 text-warning" />
          )}
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-2">
        {/* Formula */}
        <div className="bg-secondary/30 p-2 rounded text-xs">
          <p className="text-muted-foreground mb-1">Formula:</p>
          <code className="text-foreground font-mono break-all">{step.formula}</code>
        </div>

        {/* Substituted Values */}
        <div className="bg-secondary/30 p-2 rounded text-xs">
          <p className="text-muted-foreground mb-1">Values:</p>
          <code className="text-foreground font-mono break-all">{step.substituted}</code>
        </div>

        {/* Result */}
        <div className="flex items-center justify-between bg-primary/10 p-2 rounded">
          <span className="text-xs text-muted-foreground">Result:</span>
          <span className="font-mono font-semibold text-primary">
            {step.result_value.toLocaleString()} {step.result_unit}
          </span>
        </div>

        {/* Why Note */}
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{step.why_note}</span>
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-1">
            {step.warnings.map((warning, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 p-1.5 rounded">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
