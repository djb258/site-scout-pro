import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolverWaterfallStep } from "./SolverWaterfallStep";
import { Workflow, Loader2, AlertTriangle } from "lucide-react";

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
  circulationPct?: number;
}

export const SolverWaterfall = ({ steps, isLoading, circulationPct = 0 }: SolverWaterfallProps) => {
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
        {/* Persistent Circulation Approximation Banner - NOT dismissible */}
        {circulationPct > 0 && steps.length > 0 && (
          <div className="bg-amber-500/20 border-2 border-amber-500 rounded-lg p-3 sticky top-0 z-10">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              APPROXIMATION IN USE
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              circulation_pct is a placeholder until aisle packing geometry is modeled.
            </p>
          </div>
        )}
        
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