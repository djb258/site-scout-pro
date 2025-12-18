import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SolverModeToggle } from "./SolverModeToggle";
import { SolverObservedInputs } from "./SolverObservedInputs";
import { SolverTunables, Tunables } from "./SolverTunables";
import { SolverWaterfall } from "./SolverWaterfall";
import { SolverOutputs } from "./SolverOutputs";
import { SolverLockToggle } from "./SolverLockToggle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, RotateCcw, Copy } from "lucide-react";

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

interface SolverArtifact {
  solver_artifact_id: string;
  mode: 'FORWARD' | 'REVERSE';
  timestamp: string;
  calculation_steps: CalculationStep[];
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
  };
  warnings: string[];
  blocked: boolean;
  blocked_reason: string | null;
}

const DEFAULT_TUNABLES: Tunables = {
  demand_sf_per_person: 6,
  avg_unit_sf: 100,
  stormwater_pct: 10,
  circulation_pct: 25,
  archetype_footprint_sf: 15000,
  archetype_units: 147,
  archetype_rentable_sf: 20000,
  aisle_width_ft: 24,
  fire_lane_width_ft: 20,
};

const DEFAULT_JURISDICTION_CARD: JurisdictionCard = {
  front_setback_ft: 50,
  side_setback_ft: 25,
  rear_setback_ft: 30,
  max_lot_coverage_pct: 60,
  stormwater_requirement_pct: 10,
  fire_lane_width_ft: 20,
};

export const SolverShell = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<'FORWARD' | 'REVERSE'>('FORWARD');
  const [observed, setObserved] = useState<ObservedInputs>({});
  const [tunables, setTunables] = useState<Tunables>(DEFAULT_TUNABLES);
  const [jurisdictionCard] = useState<JurisdictionCard>(DEFAULT_JURISDICTION_CARD);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [artifact, setArtifact] = useState<SolverArtifact | null>(null);

  const handleModeChange = (newMode: 'FORWARD' | 'REVERSE') => {
    if (isLocked) {
      toast({
        title: "Config Locked",
        description: "Clone the run to make changes",
        variant: "destructive",
      });
      return;
    }
    setMode(newMode);
    setObserved({});
    setArtifact(null);
  };

  const handleRun = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('solver_run', {
        body: {
          mode,
          observed,
          jurisdiction_card: jurisdictionCard,
          tunables,
        },
      });

      if (error) throw error;

      setArtifact(data as SolverArtifact);
      toast({
        title: "Calculation Complete",
        description: `Artifact ${data.solver_artifact_id} generated`,
      });
    } catch (error) {
      console.error('Solver run error:', error);
      toast({
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (isLocked) {
      toast({
        title: "Config Locked",
        description: "Clone the run to make changes",
        variant: "destructive",
      });
      return;
    }
    setObserved({});
    setTunables(DEFAULT_TUNABLES);
    setArtifact(null);
  };

  const handleClone = () => {
    setIsLocked(false);
    toast({
      title: "Run Cloned",
      description: "You can now modify parameters",
    });
  };

  const canRun = () => {
    if (mode === 'FORWARD') {
      return !!observed.population && observed.population > 0;
    } else {
      return !!observed.parcel_acreage && 
             observed.parcel_acreage > 0 && 
             !!observed.parcel_width_ft && 
             !!observed.parcel_depth_ft;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Storage Viability Solver</h1>
          <p className="text-sm text-muted-foreground">Visible math with tunable parameters</p>
        </div>
        <div className="flex items-center gap-4">
          <SolverModeToggle mode={mode} onModeChange={handleModeChange} disabled={isLocked} />
          <SolverLockToggle isLocked={isLocked} onLockChange={setIsLocked} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-b border-border p-3 flex items-center gap-2">
        <Button onClick={handleRun} disabled={!canRun() || isLoading} className="gap-2">
          <Play className="h-4 w-4" />
          {isLoading ? 'Running...' : 'Run Calculation'}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={isLocked} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {isLocked && (
          <Button variant="outline" onClick={handleClone} className="gap-2">
            <Copy className="h-4 w-4" />
            Clone Run
          </Button>
        )}
        {!canRun() && (
          <span className="text-sm text-warning ml-2">
            {mode === 'FORWARD' 
              ? 'Population required' 
              : 'Parcel acreage, width, and depth required'}
          </span>
        )}
      </div>

      {/* 4-Column Layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
        {/* Column 1: Observed Inputs */}
        <div className="overflow-y-auto">
          <SolverObservedInputs
            mode={mode}
            observed={observed}
            jurisdictionCard={jurisdictionCard}
            onObservedChange={setObserved}
            isLocked={isLocked}
          />
        </div>

        {/* Column 2: Tunables */}
        <div className="overflow-y-auto">
          <SolverTunables
            mode={mode}
            tunables={tunables}
            onTunablesChange={setTunables}
            isLocked={isLocked}
          />
        </div>

        {/* Column 3: Waterfall */}
        <div className="overflow-hidden">
          <SolverWaterfall 
            steps={artifact?.calculation_steps || []} 
            isLoading={isLoading}
          />
        </div>

        {/* Column 4: Outputs */}
        <div className="overflow-hidden">
          <SolverOutputs
            mode={mode}
            outputs={artifact?.outputs || null}
            warnings={artifact?.warnings || []}
            blocked={artifact?.blocked || false}
            blockedReason={artifact?.blocked_reason || null}
            artifactId={artifact?.solver_artifact_id || null}
            timestamp={artifact?.timestamp || null}
          />
        </div>
      </div>
    </div>
  );
};
