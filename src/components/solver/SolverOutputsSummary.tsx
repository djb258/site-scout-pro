import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Building2, LayoutGrid, Ruler } from "lucide-react";

type BindingConstraint = 'SETBACK' | 'STORMWATER' | 'CIRCULATION' | 'COVERAGE' | 'FOOTPRINT';

interface SolverOutputsSummaryProps {
  mode: 'FORWARD' | 'REVERSE';
  outputs: {
    total_rentable_sf: number;
    total_unit_count: number;
    building_count: number;
    utilization_pct?: number;
    phase1_viable: boolean;
    forward_parcel_spec?: {
      min_acreage: number;
      max_acreage: number;
      geometry_unresolved: boolean;
    };
    reverse_capacity?: {
      max_units: number;
      max_rentable_sf: number;
      max_buildings: number;
      binding_constraint: BindingConstraint;
    };
  };
  artifactId: string;
}

const BINDING_LABELS: Record<BindingConstraint, string> = {
  SETBACK: 'Setback Constraints',
  STORMWATER: 'Stormwater Requirements',
  CIRCULATION: 'Circulation/Aisles',
  COVERAGE: 'Lot Coverage Cap',
  FOOTPRINT: 'Building Footprint',
};

export const SolverOutputsSummary = ({ mode, outputs, artifactId }: SolverOutputsSummaryProps) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          Solver Outputs
        </CardTitle>
        <p className="text-xs text-muted-foreground font-mono">{artifactId}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground text-xs">Total SF</p>
            <p className="font-semibold">{outputs.total_rentable_sf.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Units</p>
            <p className="font-semibold">{outputs.total_unit_count.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Buildings</p>
            <p className="font-semibold flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {outputs.building_count}
            </p>
          </div>
          {mode === 'REVERSE' && outputs.utilization_pct !== undefined && (
            <div>
              <p className="text-muted-foreground text-xs">Utilization</p>
              <p className="font-semibold">{outputs.utilization_pct.toFixed(1)}%</p>
            </div>
          )}
        </div>

        {/* Phase 1 */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {outputs.phase1_viable ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="text-xs">Phase-1 Viable: {outputs.phase1_viable ? 'YES' : 'NO'}</span>
        </div>

        {/* Mode-specific */}
        {mode === 'REVERSE' && outputs.reverse_capacity && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Binding Constraint</p>
            <Badge variant="outline" className="text-xs">
              {BINDING_LABELS[outputs.reverse_capacity.binding_constraint]}
            </Badge>
          </div>
        )}

        {mode === 'FORWARD' && outputs.forward_parcel_spec && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              Required Parcel
            </p>
            <p className="text-xs">
              {outputs.forward_parcel_spec.min_acreage.toFixed(2)} – {outputs.forward_parcel_spec.max_acreage.toFixed(2)} acres
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
