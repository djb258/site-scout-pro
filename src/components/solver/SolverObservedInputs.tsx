import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

interface ObservedInputs {
  zip?: string;
  population?: number;
  existing_supply_sf?: number;
  parcel_acreage?: number;
  parcel_width_ft?: number;
  parcel_depth_ft?: number;
  county?: string;
  jurisdiction?: string;
}

interface JurisdictionCard {
  front_setback_ft: number;
  side_setback_ft: number;
  rear_setback_ft: number;
  max_lot_coverage_pct: number;
  stormwater_requirement_pct: number;
  fire_lane_width_ft: number;
}

interface SolverObservedInputsProps {
  mode: 'FORWARD' | 'REVERSE';
  observed: ObservedInputs;
  jurisdictionCard: JurisdictionCard | null;
  onObservedChange: (observed: ObservedInputs) => void;
  isLocked: boolean;
}

export const SolverObservedInputs = ({
  mode,
  observed,
  jurisdictionCard,
  onObservedChange,
  isLocked,
}: SolverObservedInputsProps) => {
  const updateField = (field: keyof ObservedInputs, value: string | number) => {
    onObservedChange({ ...observed, [field]: value });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Observed Inputs
        </CardTitle>
        <p className="text-xs text-muted-foreground">Read-only data from upstream sources</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'FORWARD' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="zip" className="text-sm">ZIP Code</Label>
              <Input
                id="zip"
                value={observed.zip || ''}
                onChange={(e) => updateField('zip', e.target.value)}
                placeholder="e.g., 75001"
                disabled={isLocked}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="population" className="text-sm">
                Population <span className="text-destructive">*</span>
              </Label>
              <Input
                id="population"
                type="number"
                value={observed.population || ''}
                onChange={(e) => updateField('population', parseInt(e.target.value) || 0)}
                placeholder="Explicit count"
                disabled={isLocked}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Explicit number, not derived</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="existing_supply" className="text-sm">Existing Supply SF</Label>
              <Input
                id="existing_supply"
                type="number"
                value={observed.existing_supply_sf || ''}
                onChange={(e) => updateField('existing_supply_sf', parseInt(e.target.value) || 0)}
                placeholder="Current market supply"
                disabled={isLocked}
                className="font-mono"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="acreage" className="text-sm">
                Parcel Acreage <span className="text-destructive">*</span>
              </Label>
              <Input
                id="acreage"
                type="number"
                step="0.01"
                value={observed.parcel_acreage || ''}
                onChange={(e) => updateField('parcel_acreage', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 5.2"
                disabled={isLocked}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="width" className="text-sm">
                  Width (ft) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="width"
                  type="number"
                  value={observed.parcel_width_ft || ''}
                  onChange={(e) => updateField('parcel_width_ft', parseInt(e.target.value) || 0)}
                  placeholder="400"
                  disabled={isLocked}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depth" className="text-sm">
                  Depth (ft) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="depth"
                  type="number"
                  value={observed.parcel_depth_ft || ''}
                  onChange={(e) => updateField('parcel_depth_ft', parseInt(e.target.value) || 0)}
                  placeholder="565"
                  disabled={isLocked}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="county" className="text-sm">
                County <span className="text-destructive">*</span>
              </Label>
              <Input
                id="county"
                value={observed.county || ''}
                onChange={(e) => updateField('county', e.target.value)}
                placeholder="e.g., Jefferson"
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction" className="text-sm">Jurisdiction</Label>
              <Input
                id="jurisdiction"
                value={observed.jurisdiction || ''}
                onChange={(e) => updateField('jurisdiction', e.target.value)}
                placeholder="e.g., Ranson, WV"
                disabled={isLocked}
              />
            </div>
          </>
        )}

        {/* Jurisdiction Card Display */}
        {jurisdictionCard && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Jurisdiction Card
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-secondary/50 p-2 rounded">
                <span className="text-muted-foreground">Front:</span>
                <span className="ml-1 font-mono">{jurisdictionCard.front_setback_ft} ft</span>
              </div>
              <div className="bg-secondary/50 p-2 rounded">
                <span className="text-muted-foreground">Side:</span>
                <span className="ml-1 font-mono">{jurisdictionCard.side_setback_ft} ft</span>
              </div>
              <div className="bg-secondary/50 p-2 rounded">
                <span className="text-muted-foreground">Rear:</span>
                <span className="ml-1 font-mono">{jurisdictionCard.rear_setback_ft} ft</span>
              </div>
              <div className="bg-secondary/50 p-2 rounded">
                <span className="text-muted-foreground">Coverage:</span>
                <span className="ml-1 font-mono">{jurisdictionCard.max_lot_coverage_pct}%</span>
              </div>
              <div className="bg-secondary/50 p-2 rounded">
                <span className="text-muted-foreground">Stormwater:</span>
                <span className="ml-1 font-mono">{jurisdictionCard.stormwater_requirement_pct}%</span>
              </div>
              <div className="bg-secondary/50 p-2 rounded">
                <span className="text-muted-foreground">Fire Lane:</span>
                <span className="ml-1 font-mono">{jurisdictionCard.fire_lane_width_ft} ft</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
