import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, TrendingUp, Building2, LayoutGrid, Percent, AlertTriangle } from "lucide-react";

interface SolverOutputsProps {
  mode: 'FORWARD' | 'REVERSE';
  outputs: {
    total_rentable_sf: number;
    total_unit_count: number;
    building_count: number;
    utilization_pct: number;
    phase1_viable: boolean;
    forward_parcel_spec?: {
      min_width_ft: number;
      min_depth_ft: number;
      min_acreage: number;
    };
    reverse_capacity?: {
      max_units: number;
      max_rentable_sf: number;
      max_buildings: number;
    };
  } | null;
  warnings: string[];
  blocked: boolean;
  blockedReason: string | null;
  artifactId: string | null;
  timestamp: string | null;
}

export const SolverOutputs = ({
  mode,
  outputs,
  warnings,
  blocked,
  blockedReason,
  artifactId,
  timestamp,
}: SolverOutputsProps) => {
  if (!outputs && !blocked) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Outputs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Run calculation to see outputs
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Outputs + Diff View
        </CardTitle>
        {artifactId && (
          <div className="space-y-1 mt-2">
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">{artifactId}</code>
            </div>
            {timestamp && (
              <p className="text-xs text-muted-foreground">
                {new Date(timestamp).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Blocked State */}
        {blocked && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">BLOCKED</span>
            </div>
            {blockedReason && (
              <p className="text-sm text-destructive/80 mt-1">{blockedReason}</p>
            )}
          </div>
        )}

        {outputs && (
          <>
            {/* Main Outputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary/50 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="text-xs">Total Rentable SF</span>
                </div>
                <p className="font-mono font-semibold text-lg">
                  {outputs.total_rentable_sf.toLocaleString()}
                </p>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="text-xs">Unit Count</span>
                </div>
                <p className="font-mono font-semibold text-lg">
                  {outputs.total_unit_count.toLocaleString()}
                </p>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="text-xs">Buildings</span>
                </div>
                <p className="font-mono font-semibold text-lg">
                  {outputs.building_count}
                </p>
              </div>
              {mode === 'REVERSE' && (
                <div className="bg-secondary/50 p-3 rounded-lg">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Percent className="h-3.5 w-3.5" />
                    <span className="text-xs">Utilization</span>
                  </div>
                  <p className="font-mono font-semibold text-lg">
                    {outputs.utilization_pct}%
                  </p>
                </div>
              )}
            </div>

            {/* Phase-1 Viable */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              outputs.phase1_viable ? 'bg-success/10' : 'bg-destructive/10'
            }`}>
              <span className="text-sm font-medium">Phase-1 Viable</span>
              {outputs.phase1_viable ? (
                <Badge variant="default" className="bg-success text-success-foreground">
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  YES
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  NO
                </Badge>
              )}
            </div>

            {/* Mode-specific outputs */}
            {mode === 'FORWARD' && outputs.forward_parcel_spec && (
              <div className="border border-border rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">Parcel Specification (Shopping List)</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Width:</span>
                    <span className="font-mono">{outputs.forward_parcel_spec.min_width_ft.toLocaleString()} ft</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Depth:</span>
                    <span className="font-mono">{outputs.forward_parcel_spec.min_depth_ft.toLocaleString()} ft</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Acreage:</span>
                    <span className="font-mono">{outputs.forward_parcel_spec.min_acreage} acres</span>
                  </div>
                </div>
              </div>
            )}

            {mode === 'REVERSE' && outputs.reverse_capacity && (
              <div className="border border-border rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">Maximum Capacity (Ceiling)</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Units:</span>
                    <span className="font-mono">{outputs.reverse_capacity.max_units.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Rentable SF:</span>
                    <span className="font-mono">{outputs.reverse_capacity.max_rentable_sf.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Buildings:</span>
                    <span className="font-mono">{outputs.reverse_capacity.max_buildings}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Warnings
                </h4>
                {warnings.map((warning, idx) => (
                  <div key={idx} className="text-xs text-warning bg-warning/10 p-2 rounded">
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
