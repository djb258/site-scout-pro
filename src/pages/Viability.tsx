import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SolverModeToggle } from "@/components/solver/SolverModeToggle";
import { SolverObservedInputs } from "@/components/solver/SolverObservedInputs";
import { SolverTunables, Tunables } from "@/components/solver/SolverTunables";
import { SolverWaterfall } from "@/components/solver/SolverWaterfall";
import { SolverLockToggle } from "@/components/solver/SolverLockToggle";
import { SolverOutputsSummary } from "@/components/solver/SolverOutputsSummary";
import { SolverDecisionGates } from "@/components/solver/SolverDecisionGates";
import { SolverDecisionForm } from "@/components/solver/SolverDecisionForm";
import { SolverDecisionOutput } from "@/components/solver/SolverDecisionOutput";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, RotateCcw, Copy, ArrowLeft, Calculator, Gavel } from "lucide-react";

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

type BindingConstraint = 'SETBACK' | 'STORMWATER' | 'CIRCULATION' | 'COVERAGE' | 'FOOTPRINT';

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
  warnings: string[];
  blocked: boolean;
  blocked_reason: string | null;
}

type DecisionType = 'GO' | 'HOLD' | 'NO_GO';
type ScopeType = 'PHASE_1' | 'FULL_BUILD' | 'PARTIAL';
type TimingType = 'IMMEDIATE' | 'CONTINGENT' | 'DEFERRED';
type ConfidenceType = 'HIGH' | 'MEDIUM' | 'LOW';

interface DecisionRecord {
  decision_id: string;
  solver_artifact_id: string;
  decision: DecisionType;
  scope: ScopeType;
  timing: TimingType;
  confidence: ConfidenceType;
  rationale: string;
  committed_at: string;
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

const Viability = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<'FORWARD' | 'REVERSE'>('FORWARD');
  const [observed, setObserved] = useState<ObservedInputs>({});
  const [tunables, setTunables] = useState<Tunables>(DEFAULT_TUNABLES);
  const [jurisdictionCard] = useState<JurisdictionCard>(DEFAULT_JURISDICTION_CARD);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [artifact, setArtifact] = useState<SolverArtifact | null>(null);
  
  // Decision state
  const [isCommitting, setIsCommitting] = useState(false);
  const [decisionRecord, setDecisionRecord] = useState<DecisionRecord | null>(null);

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
    setDecisionRecord(null);
  };

  const handleRun = async () => {
    setIsLoading(true);
    setDecisionRecord(null);
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
    setDecisionRecord(null);
  };

  const handleClone = () => {
    setIsLocked(false);
    setDecisionRecord(null);
    toast({
      title: "Run Cloned",
      description: "You can now modify parameters",
    });
  };

  const handleCommitDecision = async (data: {
    decision: DecisionType;
    scope: ScopeType;
    timing: TimingType;
    confidence: ConfidenceType;
    rationale: string;
  }) => {
    if (!artifact) return;
    
    setIsCommitting(true);
    try {
      // Generate a decision ID (in production, this would come from the backend)
      const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
      
      const record: DecisionRecord = {
        decision_id: decisionId,
        solver_artifact_id: artifact.solver_artifact_id,
        decision: data.decision,
        scope: data.scope,
        timing: data.timing,
        confidence: data.confidence,
        rationale: data.rationale,
        committed_at: new Date().toISOString(),
      };
      
      // In production, this would persist to the database
      // For now, just set it locally
      setDecisionRecord(record);
      setIsLocked(true);
      
      toast({
        title: "Decision Committed",
        description: `${data.decision} decision recorded with ID ${decisionId}`,
      });
    } catch (error) {
      console.error('Decision commit error:', error);
      toast({
        title: "Commit Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <SolverModeToggle mode={mode} onModeChange={handleModeChange} disabled={isLocked} />
          <SolverLockToggle isLocked={isLocked} onLockChange={setIsLocked} />
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border p-4">
        <h1 className="text-2xl font-bold">Storage Viability & Decision Engine</h1>
        <p className="text-sm text-muted-foreground">Visible math → Gates → GO/HOLD/NO-GO</p>
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

      {/* SOLVER SECTION */}
      <section className="border-b border-border">
        <div className="p-3 bg-muted/30 border-b flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">SOLVER: THE MATH</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_2fr] gap-4 p-4 max-h-[50vh] overflow-hidden">
          {/* Column 1: Observed Inputs */}
          <div className="overflow-y-auto max-h-[45vh]">
            <SolverObservedInputs
              mode={mode}
              observed={observed}
              jurisdictionCard={jurisdictionCard}
              onObservedChange={setObserved}
              isLocked={isLocked}
            />
          </div>

          {/* Column 2: Tunables */}
          <div className="overflow-y-auto max-h-[45vh]">
            <SolverTunables
              mode={mode}
              tunables={tunables}
              onTunablesChange={setTunables}
              isLocked={isLocked}
            />
          </div>

          {/* Column 3: Waterfall (50% width) */}
          <div className="overflow-hidden max-h-[45vh]">
            <SolverWaterfall 
              steps={artifact?.calculation_steps || []} 
              isLoading={isLoading}
              circulationPct={tunables.circulation_pct}
            />
          </div>
        </div>
      </section>

      {/* DECISION SECTION - Only shows after solver run */}
      {artifact && (
        <section className="flex-1 overflow-hidden">
          <div className="p-3 bg-muted/30 border-b flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">DECISION: BASED ON THE MATH ABOVE</h2>
            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {artifact.solver_artifact_id}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 max-h-[40vh] overflow-y-auto">
            {/* Column 1: Solver Outputs Summary */}
            <SolverOutputsSummary
              mode={mode}
              outputs={artifact.outputs}
              artifactId={artifact.solver_artifact_id}
            />

            {/* Column 2: Eligibility Gates */}
            <SolverDecisionGates
              outputs={artifact.outputs}
              blocked={artifact.blocked}
              blockedReason={artifact.blocked_reason}
              warnings={artifact.warnings}
            />

            {/* Column 3: Decision Form */}
            <SolverDecisionForm
              artifactId={artifact.solver_artifact_id}
              onCommit={handleCommitDecision}
              isCommitting={isCommitting}
              disabled={!!decisionRecord}
            />

            {/* Column 4: Decision Output */}
            <SolverDecisionOutput
              record={decisionRecord}
              isPending={!decisionRecord && !isCommitting}
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default Viability;
