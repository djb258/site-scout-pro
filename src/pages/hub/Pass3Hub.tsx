import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, Play, Loader2, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { SolverModeToggle } from "@/components/solver/SolverModeToggle";
import { SolverLockToggle } from "@/components/solver/SolverLockToggle";
import { SolverObservedInputs } from "@/components/solver/SolverObservedInputs";
import { SolverTunables, type Tunables } from "@/components/solver/SolverTunables";
import { SolverOutputs } from "@/components/solver/SolverOutputs";
import { SolverWaterfall } from "@/components/solver/SolverWaterfall";
import { SolverDecisionGates } from "@/components/solver/SolverDecisionGates";
import { PipelineDocPanel } from "@/components/PipelineDocPanel";
import { ToolGovernanceCard } from "@/components/ToolGovernanceCard";
import { ProductionReadinessPanel } from "@/components/ProductionReadinessPanel";
import { useJurisdictionCard, type SolverJurisdictionCard } from "@/hooks/useJurisdictionCard";

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

const DEFAULT_TUNABLES: Tunables = {
  demand_sf_per_person: 6,
  avg_unit_sf: 100,
  stormwater_pct: 15,
  circulation_pct: 25,
  archetype_footprint_sf: 15000,
  archetype_units: 147,
  archetype_rentable_sf: 20000,
  aisle_width_ft: 26,
  fire_lane_width_ft: 24,
};

const Pass3Hub = () => {
  const { toast } = useToast();
  
  // Jurisdiction card from Pass 2
  const { 
    card: jurisdictionData, 
    solverCard, 
    isLoading: isLoadingCard, 
    error: cardError,
    warnings: cardWarnings,
    status: cardStatus,
    fetchCard 
  } = useJurisdictionCard();
  
  // Solver state
  const [mode, setMode] = useState<'FORWARD' | 'REVERSE'>('REVERSE');
  const [isLocked, setIsLocked] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Input state
  const [observed, setObserved] = useState<ObservedInputs>({
    parcel_acreage: 5.2,
    parcel_width_ft: 400,
    parcel_depth_ft: 565,
    county: 'Jefferson',
    jurisdiction: 'Ranson, WV',
    population: 50000,
    existing_supply_sf: 150000,
  });
  const [tunables, setTunables] = useState<Tunables>(DEFAULT_TUNABLES);
  
  // Output state
  const [artifact, setArtifact] = useState<SolverArtifact | null>(null);

  // Fetch jurisdiction card when county/jurisdiction changes
  useEffect(() => {
    if (observed.county && observed.jurisdiction) {
      const state = observed.jurisdiction.split(',')[1]?.trim() || 'WV';
      fetchCard(observed.county, state);
    }
  }, [observed.county, observed.jurisdiction, fetchCard]);

  const runSolver = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('solver_run', {
        body: {
          mode,
          observed,
          jurisdiction_card: solverCard,
          tunables,
        },
      });

      if (error) throw error;

      setArtifact(data);
      toast({
        title: "Calculation Complete",
        description: `Artifact: ${data.solver_artifact_id}`,
      });
    } catch (err) {
      console.error('Solver error:', err);
      toast({
        title: "Calculation Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex-1 bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground font-mono">Hub 3 — Feasibility Solver</h1>
                <p className="text-muted-foreground">Forward & Reverse Capacity Calculations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono">
                {mode} MODE
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Production Readiness Panel (Collapsible) */}
        <Collapsible className="mb-6">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>System Production Readiness</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <ProductionReadinessPanel />
          </CollapsibleContent>
        </Collapsible>

        {/* Pipeline Documentation & Governance */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-8">
            <PipelineDocPanel passNumber={3} />
          </div>
          <div className="col-span-4">
            <ToolGovernanceCard passNumber={3} />
          </div>
        </div>

        {/* Jurisdiction Card Status */}
        {cardError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {cardError} - Using default jurisdiction values
            </AlertDescription>
          </Alert>
        )}
        {cardWarnings.length > 0 && !cardError && (
          <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200">
              {cardWarnings.join('; ')}
            </AlertDescription>
          </Alert>
        )}
        {cardStatus === 'found' && jurisdictionData && (
          <Alert className="mb-6 border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <AlertDescription className="text-emerald-200">
              Jurisdiction card loaded: {jurisdictionData.county_name} County, {jurisdictionData.state}
              {jurisdictionData.envelope_complete ? ' (envelope complete)' : ' (envelope incomplete)'}
            </AlertDescription>
          </Alert>
        )}

        {/* HARD STOP: Blocked or Error Jurisdiction */}
        {(cardStatus === 'blocked' || cardStatus === 'error') && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>CALCULATION DISABLED</strong> — Jurisdiction data is {cardStatus}. 
              {cardStatus === 'blocked' 
                ? ' Fatal prohibition detected. Cannot proceed with feasibility analysis.' 
                : ' Unable to load jurisdiction constraints. Fix Pass 2 data first.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Controls Row */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <SolverModeToggle mode={mode} onModeChange={setMode} disabled={isRunning} />
                <SolverLockToggle isLocked={isLocked} onLockChange={setIsLocked} disabled={isRunning} />
              </div>
              <Button 
                onClick={runSolver} 
                disabled={isRunning || isLoadingCard || cardStatus === 'blocked' || cardStatus === 'error'} 
                size="lg" 
                className="gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : cardStatus === 'blocked' || cardStatus === 'error' ? (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Calculation Blocked
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Calculation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Inputs */}
          <div className="col-span-3 space-y-6">
            <SolverObservedInputs
              mode={mode}
              observed={observed}
              jurisdictionCard={solverCard}
              onObservedChange={setObserved}
              isLocked={isLocked}
            />
            <SolverTunables
              mode={mode}
              tunables={tunables}
              onTunablesChange={setTunables}
              isLocked={isLocked}
            />
          </div>

          {/* Center Column - Waterfall */}
          <div className="col-span-5">
            <SolverWaterfall
              steps={artifact?.calculation_steps || []}
              isLoading={isRunning}
              circulationPct={tunables.circulation_pct}
            />
          </div>

          {/* Right Column - Outputs */}
          <div className="col-span-4 space-y-6">
            <SolverOutputs
              mode={mode}
              outputs={artifact?.outputs || null}
              warnings={artifact?.warnings || []}
              blocked={artifact?.blocked || false}
              blockedReason={artifact?.blocked_reason || null}
              artifactId={artifact?.solver_artifact_id || null}
              timestamp={artifact?.timestamp || null}
              circulationPct={tunables.circulation_pct}
            />
            {artifact && (
              <SolverDecisionGates
                outputs={artifact.outputs}
                blocked={artifact.blocked}
                blockedReason={artifact.blocked_reason}
                warnings={artifact.warnings}
              />
            )}
          </div>
        </div>

        {/* Footer Status */}
        {artifact && (
          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
            <span>Last Run: {new Date(artifact.timestamp).toLocaleString()}</span>
            <span className="font-mono">{artifact.solver_artifact_id}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pass3Hub;
