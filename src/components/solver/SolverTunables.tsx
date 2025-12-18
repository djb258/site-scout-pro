import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, HelpCircle } from "lucide-react";

export interface Tunables {
  demand_sf_per_person: number;
  avg_unit_sf: number;
  stormwater_pct: number;
  circulation_pct: number;
  archetype_footprint_sf: number;
  archetype_units: number;
  archetype_rentable_sf: number;
  aisle_width_ft: number;
  fire_lane_width_ft: number;
}

const ARCHETYPES = [
  { id: 'std-147', name: 'Standard 147-Unit', footprint: 15000, units: 147, rentable: 20000 },
  { id: 'mid-80', name: 'Mid-Size 80-Unit', footprint: 9000, units: 80, rentable: 12000 },
  { id: 'small-50', name: 'Small 50-Unit', footprint: 5500, units: 50, rentable: 7000 },
  { id: 'large-200', name: 'Large 200-Unit', footprint: 21000, units: 200, rentable: 28000 },
];

interface TunableFieldProps {
  label: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  disabled?: boolean;
  step?: string;
}

const TunableField = ({ label, tooltip, value, onChange, unit, disabled, step = "1" }: TunableFieldProps) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1">
      <Label className="text-xs">{label}</Label>
      <Tooltip>
        <TooltipTrigger>
          <HelpCircle className="h-3 w-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="font-mono h-8 text-sm"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>
    </div>
  </div>
);

interface SolverTunablesProps {
  mode: 'FORWARD' | 'REVERSE';
  tunables: Tunables;
  onTunablesChange: (tunables: Tunables) => void;
  isLocked: boolean;
}

export const SolverTunables = ({
  mode,
  tunables,
  onTunablesChange,
  isLocked,
}: SolverTunablesProps) => {
  const updateField = (field: keyof Tunables, value: number) => {
    onTunablesChange({ ...tunables, [field]: value });
  };

  const handleArchetypeChange = (archetypeId: string) => {
    const archetype = ARCHETYPES.find(a => a.id === archetypeId);
    if (archetype) {
      onTunablesChange({
        ...tunables,
        archetype_footprint_sf: archetype.footprint,
        archetype_units: archetype.units,
        archetype_rentable_sf: archetype.rentable,
      });
    }
  };

  const currentArchetype = ARCHETYPES.find(
    a => a.footprint === tunables.archetype_footprint_sf && 
         a.units === tunables.archetype_units
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Tunable Parameters
        </CardTitle>
        <p className="text-xs text-muted-foreground">Adjust these knobs to see impact</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Archetype Selector */}
        <div className="space-y-1">
          <Label className="text-xs">Building Archetype</Label>
          <Select
            value={currentArchetype?.id || 'custom'}
            onValueChange={handleArchetypeChange}
            disabled={isLocked}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select archetype" />
            </SelectTrigger>
            <SelectContent>
              {ARCHETYPES.map(arch => (
                <SelectItem key={arch.id} value={arch.id}>
                  {arch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Forward-specific tunables */}
        {mode === 'FORWARD' && (
          <>
            <TunableField
              label="demand_sf_per_person"
              tooltip="Industry standard: 6 sqft storage per capita"
              value={tunables.demand_sf_per_person}
              onChange={(v) => updateField('demand_sf_per_person', v)}
              unit="sqft/person"
              disabled={isLocked}
            />
            <TunableField
              label="avg_unit_sf"
              tooltip="Blended average unit size from mix"
              value={tunables.avg_unit_sf}
              onChange={(v) => updateField('avg_unit_sf', v)}
              unit="sqft"
              disabled={isLocked}
            />
          </>
        )}

        {/* Common tunables */}
        <TunableField
          label="stormwater_pct"
          tooltip="Override jurisdiction default if known"
          value={tunables.stormwater_pct}
          onChange={(v) => updateField('stormwater_pct', v)}
          unit="%"
          disabled={isLocked}
        />
        <TunableField
          label="circulation_pct"
          tooltip="Approx % of buildable area for aisles/drives"
          value={tunables.circulation_pct}
          onChange={(v) => updateField('circulation_pct', v)}
          unit="%"
          disabled={isLocked}
        />

        {/* Archetype details */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Archetype Details</p>
          <TunableField
            label="archetype_footprint_sf"
            tooltip="Building footprint from selected archetype"
            value={tunables.archetype_footprint_sf}
            onChange={(v) => updateField('archetype_footprint_sf', v)}
            unit="sqft"
            disabled={isLocked}
          />
          <div className="mt-2">
            <TunableField
              label="archetype_units"
              tooltip="Units per building from selected archetype"
              value={tunables.archetype_units}
              onChange={(v) => updateField('archetype_units', v)}
              unit="units"
              disabled={isLocked}
            />
          </div>
          <div className="mt-2">
            <TunableField
              label="archetype_rentable_sf"
              tooltip="Rentable SF per building"
              value={tunables.archetype_rentable_sf}
              onChange={(v) => updateField('archetype_rentable_sf', v)}
              unit="sqft"
              disabled={isLocked}
            />
          </div>
        </div>

        {/* Lane widths */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Lane Widths</p>
          <div className="grid grid-cols-2 gap-2">
            <TunableField
              label="aisle_width_ft"
              tooltip="Standard drive aisle width"
              value={tunables.aisle_width_ft}
              onChange={(v) => updateField('aisle_width_ft', v)}
              unit="ft"
              disabled={isLocked}
            />
            <TunableField
              label="fire_lane_width_ft"
              tooltip="Override jurisdiction default if known"
              value={tunables.fire_lane_width_ft}
              onChange={(v) => updateField('fire_lane_width_ft', v)}
              unit="ft"
              disabled={isLocked}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
