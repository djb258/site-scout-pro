import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolverWaterfallStep } from "./SolverWaterfallStep";
import { Workflow, Loader2 } from "lucide-react";

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

interface SolverWaterfallProps {
  steps: CalculationStep[];
  isLoading?: boolean;
}

export const SolverWaterfall = ({ steps, isLoading }: SolverWaterfallProps) => {
  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          Calculation Waterfall
        </CardTitle>
        <p className="text-xs text-muted-foreground">Each step shows formula → values → result</p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : steps.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Run calculation to see steps
          </div>
        ) : (
          steps.map((step) => (
            <SolverWaterfallStep key={step.step_number} step={step} />
          ))
        )}
      </CardContent>
    </Card>
  );
};
