import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROCESS_ID = 'solver_run';
const PASS_NUMBER = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface SolverRunInput {
  mode: 'FORWARD' | 'REVERSE';
  envelope_complete: boolean; // REQUIRED: Hard guard enforced
  observed: {
    zip?: string;
    population?: number;
    existing_supply_sf?: number;
    parcel_acreage?: number;
    parcel_width_ft?: number;
    parcel_depth_ft?: number;
    county?: string;
    jurisdiction?: string;
  };
  jurisdiction_card?: {
    front_setback_ft: number;
    side_setback_ft: number;
    rear_setback_ft: number;
    max_lot_coverage_pct: number;
    stormwater_requirement_pct: number;
    fire_lane_width_ft: number;
  };
  tunables: {
    demand_sf_per_person: number;
    avg_unit_sf: number;
    stormwater_pct: number;
    circulation_pct: number;
    archetype_footprint_sf: number;
    archetype_units: number;
    archetype_rentable_sf: number;
    aisle_width_ft: number;
    fire_lane_width_ft: number;
  };
  previous_artifact_id?: string;
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
  observed_snapshot: SolverRunInput['observed'];
  tunables_snapshot: SolverRunInput['tunables'];
  jurisdiction_card_snapshot: SolverRunInput['jurisdiction_card'] | null;
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
  diff?: {
    tunables_changed: Record<string, { old: number; new: number }>;
    outputs_changed: Record<string, { old: number; new: number; delta: number }>;
  };
  warnings: string[];
  blocked: boolean;
  blocked_reason: string | null;
}

function generateArtifactId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `svr_${timestamp}_${random}`;
}

function runForwardSolver(input: SolverRunInput): { steps: CalculationStep[]; outputs: SolverArtifact['outputs']; warnings: string[] } {
  const steps: CalculationStep[] = [];
  const warnings: string[] = [];
  const { observed, tunables } = input;

  // Validation
  if (!observed.population || observed.population <= 0) {
    return {
      steps: [],
      outputs: {
        total_rentable_sf: 0,
        total_unit_count: 0,
        building_count: 0,
        utilization_pct: 0,
        phase1_viable: false,
      },
      warnings: ['BLOCKED: Population is required for Forward mode'],
    };
  }

  // Step 1: Demand Calculation
  const demandSF = observed.population * tunables.demand_sf_per_person;
  steps.push({
    step_number: 1,
    step_name: 'Demand Calculation',
    formula: 'DemandSF = population × demand_sf_per_person',
    substituted: `DemandSF = ${observed.population.toLocaleString()} × ${tunables.demand_sf_per_person}`,
    result_value: demandSF,
    result_unit: 'sqft',
    why_note: 'Baseline storage demand from population',
    warnings: [],
  });

  // Step 2: Gap Calculation
  const existingSupply = observed.existing_supply_sf || 0;
  const gapSF = Math.max(0, demandSF - existingSupply);
  steps.push({
    step_number: 2,
    step_name: 'Gap Calculation',
    formula: 'GapSF = max(0, DemandSF − ExistingSupplySF)',
    substituted: `GapSF = max(0, ${demandSF.toLocaleString()} − ${existingSupply.toLocaleString()})`,
    result_value: gapSF,
    result_unit: 'sqft',
    why_note: 'Unmet demand after existing supply',
    warnings: gapSF === 0 ? ['Market is oversupplied'] : [],
  });

  // Step 3: Target Units
  const targetUnits = Math.ceil(gapSF / tunables.avg_unit_sf);
  steps.push({
    step_number: 3,
    step_name: 'Target Units',
    formula: 'TargetUnits = GapSF ÷ avg_unit_sf',
    substituted: `TargetUnits = ${gapSF.toLocaleString()} ÷ ${tunables.avg_unit_sf}`,
    result_value: targetUnits,
    result_unit: 'units',
    why_note: 'Converts sqft demand to unit count',
    warnings: [],
  });

  // Step 4: Target Buildings
  const targetBuildings = Math.ceil(targetUnits / tunables.archetype_units);
  steps.push({
    step_number: 4,
    step_name: 'Target Buildings',
    formula: 'TargetBuildings = ceil(TargetUnits ÷ archetype_units)',
    substituted: `TargetBuildings = ceil(${targetUnits.toLocaleString()} ÷ ${tunables.archetype_units})`,
    result_value: targetBuildings,
    result_unit: 'buildings',
    why_note: 'No fractional buildings',
    warnings: [],
  });

  // Step 5: Required Parcel Spec
  const requiredFootprint = targetBuildings * tunables.archetype_footprint_sf;
  const overheadMultiplier = 1 / (1 - tunables.stormwater_pct / 100 - tunables.circulation_pct / 100);
  const requiredWithOverhead = requiredFootprint * overheadMultiplier;
  const requiredAcres = requiredWithOverhead / 43560;

  const stepWarnings: string[] = [];
  if (tunables.circulation_pct > 0) {
    stepWarnings.push('circulation_pct is an approximation');
    warnings.push('Using circulation_pct instead of true aisle packing geometry');
  }

  steps.push({
    step_number: 5,
    step_name: 'Parcel Specification',
    formula: 'RequiredFootprint = TargetBuildings × archetype_footprint_sf; RequiredWithOverhead = RequiredFootprint ÷ (1 - stormwater_pct - circulation_pct); RequiredAcres = RequiredWithOverhead ÷ 43,560',
    substituted: `RequiredFootprint = ${targetBuildings} × ${tunables.archetype_footprint_sf.toLocaleString()} = ${requiredFootprint.toLocaleString()} sqft; RequiredWithOverhead = ${requiredFootprint.toLocaleString()} ÷ (1 - ${tunables.stormwater_pct / 100} - ${tunables.circulation_pct / 100}) = ${Math.round(requiredWithOverhead).toLocaleString()} sqft; RequiredAcres = ${Math.round(requiredWithOverhead).toLocaleString()} ÷ 43,560 = ${requiredAcres.toFixed(2)}`,
    result_value: Math.round(requiredAcres * 100) / 100,
    result_unit: 'acres',
    why_note: 'Defines the shopping list for land search',
    warnings: stepWarnings,
  });

  const totalRentableSF = targetBuildings * tunables.archetype_rentable_sf;
  const totalUnits = targetBuildings * tunables.archetype_units;

  // Add geometry unresolved warning
  warnings.push('Geometry unresolved — parcel dimensions not inferred');

  return {
    steps,
    outputs: {
      total_rentable_sf: totalRentableSF,
      total_unit_count: totalUnits,
      building_count: targetBuildings,
      utilization_pct: 100, // Forward mode doesn't have utilization
      phase1_viable: targetBuildings >= 1,
      forward_parcel_spec: {
        min_acreage: Math.round(requiredAcres * 100) / 100,
        max_acreage: Math.round(requiredAcres * 1.25 * 100) / 100, // 25% buffer
        geometry_unresolved: true,
      },
    },
    warnings,
  };
}

function runReverseSolver(input: SolverRunInput): { steps: CalculationStep[]; outputs: SolverArtifact['outputs']; warnings: string[] } {
  const steps: CalculationStep[] = [];
  const warnings: string[] = [];
  const { observed, tunables, jurisdiction_card } = input;

  // Validation
  if (!observed.parcel_acreage || observed.parcel_acreage <= 0) {
    return {
      steps: [],
      outputs: {
        total_rentable_sf: 0,
        total_unit_count: 0,
        building_count: 0,
        utilization_pct: 0,
        phase1_viable: false,
      },
      warnings: ['BLOCKED: Parcel acreage is required for Reverse mode'],
    };
  }

  if (!observed.parcel_width_ft || !observed.parcel_depth_ft) {
    return {
      steps: [],
      outputs: {
        total_rentable_sf: 0,
        total_unit_count: 0,
        building_count: 0,
        utilization_pct: 0,
        phase1_viable: false,
      },
      warnings: ['BLOCKED: Parcel width and depth are required for Reverse mode'],
    };
  }

  // Use jurisdiction card or defaults
  const frontSetback = jurisdiction_card?.front_setback_ft || 50;
  const sideSetback = jurisdiction_card?.side_setback_ft || 25;
  const rearSetback = jurisdiction_card?.rear_setback_ft || 30;
  const maxCoverage = jurisdiction_card?.max_lot_coverage_pct || 60;

  // Step 1: Gross Area
  const grossArea = observed.parcel_acreage * 43560;
  steps.push({
    step_number: 1,
    step_name: 'Gross Area',
    formula: 'GrossArea = acreage × 43,560',
    substituted: `GrossArea = ${observed.parcel_acreage} × 43,560`,
    result_value: Math.round(grossArea),
    result_unit: 'sqft',
    why_note: 'Convert acres to square feet',
    warnings: [],
  });

  // Step 2: Setback Envelope
  const netWidth = observed.parcel_width_ft - (2 * sideSetback);
  const netDepth = observed.parcel_depth_ft - frontSetback - rearSetback;
  const netArea = netWidth * netDepth;
  const envelopeCollapsed = netWidth <= 0 || netDepth <= 0;

  const setbackWarnings: string[] = [];
  if (envelopeCollapsed) {
    setbackWarnings.push('ENVELOPE COLLAPSED - parcel too small for setbacks');
  }

  steps.push({
    step_number: 2,
    step_name: 'Setback Envelope',
    formula: 'NetWidth = parcel_width - (2 × side_setback); NetDepth = parcel_depth - front_setback - rear_setback; NetArea = NetWidth × NetDepth',
    substituted: `NetWidth = ${observed.parcel_width_ft} - (2 × ${sideSetback}) = ${netWidth} ft; NetDepth = ${observed.parcel_depth_ft} - ${frontSetback} - ${rearSetback} = ${netDepth} ft; NetArea = ${netWidth} × ${netDepth} = ${Math.round(netArea).toLocaleString()} sqft`,
    result_value: Math.max(0, Math.round(netArea)),
    result_unit: 'sqft',
    why_note: 'Setbacks are geometric offsets, not percentages',
    warnings: setbackWarnings,
  });

  if (envelopeCollapsed) {
    return {
      steps,
      outputs: {
        total_rentable_sf: 0,
        total_unit_count: 0,
        building_count: 0,
        utilization_pct: 0,
        phase1_viable: false,
      },
      warnings: ['BLOCKED: Envelope collapsed - parcel too small for required setbacks'],
    };
  }

  // Step 3: Stormwater Reserve
  const stormwaterReserve = netArea * (tunables.stormwater_pct / 100);
  const afterStormwater = netArea - stormwaterReserve;
  steps.push({
    step_number: 3,
    step_name: 'Stormwater Reserve',
    formula: 'StormwaterReserve = NetArea × stormwater_pct; RemainingArea = NetArea - StormwaterReserve',
    substituted: `StormwaterReserve = ${Math.round(netArea).toLocaleString()} × ${tunables.stormwater_pct}% = ${Math.round(stormwaterReserve).toLocaleString()} sqft; RemainingArea = ${Math.round(netArea).toLocaleString()} - ${Math.round(stormwaterReserve).toLocaleString()} = ${Math.round(afterStormwater).toLocaleString()} sqft`,
    result_value: Math.round(afterStormwater),
    result_unit: 'sqft',
    why_note: 'Stormwater is area-based, not footprint-based',
    warnings: [],
  });

  // Step 4: Circulation Reserve
  const circulationReserve = afterStormwater * (tunables.circulation_pct / 100);
  const buildableArea = afterStormwater - circulationReserve;

  const circWarnings: string[] = [];
  if (tunables.circulation_pct > 0) {
    circWarnings.push('Using circulation_pct instead of true aisle packing geometry');
    warnings.push('Using circulation_pct instead of true aisle packing geometry');
  }

  steps.push({
    step_number: 4,
    step_name: 'Circulation Reserve',
    formula: 'CirculationReserve = RemainingArea × circulation_pct; BuildableArea = RemainingArea - CirculationReserve',
    substituted: `CirculationReserve = ${Math.round(afterStormwater).toLocaleString()} × ${tunables.circulation_pct}% = ${Math.round(circulationReserve).toLocaleString()} sqft; BuildableArea = ${Math.round(afterStormwater).toLocaleString()} - ${Math.round(circulationReserve).toLocaleString()} = ${Math.round(buildableArea).toLocaleString()} sqft`,
    result_value: Math.round(buildableArea),
    result_unit: 'sqft',
    why_note: 'Approximate circulation based on percentage',
    warnings: circWarnings,
  });

  // Step 5: Coverage Cap Check
  const coverageCap = netArea * (maxCoverage / 100);
  const effectiveBuildable = Math.min(buildableArea, coverageCap);
  const isCapped = buildableArea > coverageCap;

  steps.push({
    step_number: 5,
    step_name: 'Coverage Cap Check',
    formula: 'CoverageCap = NetArea × max_lot_coverage_pct; EffectiveBuildable = min(BuildableArea, CoverageCap)',
    substituted: `CoverageCap = ${Math.round(netArea).toLocaleString()} × ${maxCoverage}% = ${Math.round(coverageCap).toLocaleString()} sqft; EffectiveBuildable = min(${Math.round(buildableArea).toLocaleString()}, ${Math.round(coverageCap).toLocaleString()}) = ${Math.round(effectiveBuildable).toLocaleString()} sqft`,
    result_value: Math.round(effectiveBuildable),
    result_unit: 'sqft',
    why_note: 'Coverage is a CAP, not a driver',
    warnings: isCapped ? ['Coverage limit is the binding constraint'] : [],
  });

  // Step 6: Building Packing
  const maxBuildings = Math.floor(effectiveBuildable / tunables.archetype_footprint_sf);
  const footprintUsed = maxBuildings * tunables.archetype_footprint_sf;
  const maxUnits = maxBuildings * tunables.archetype_units;
  const maxRentableSF = maxBuildings * tunables.archetype_rentable_sf;

  steps.push({
    step_number: 6,
    step_name: 'Building Packing',
    formula: 'MaxBuildings = floor(EffectiveBuildable ÷ archetype_footprint_sf)',
    substituted: `MaxBuildings = floor(${Math.round(effectiveBuildable).toLocaleString()} ÷ ${tunables.archetype_footprint_sf.toLocaleString()}) = ${maxBuildings}`,
    result_value: maxBuildings,
    result_unit: 'buildings',
    why_note: 'No fractional buildings',
    warnings: maxBuildings === 0 ? ['No buildings fit on this parcel'] : [],
  });

  // Determine binding constraint by checking what limited capacity first
  let bindingConstraint: BindingConstraint = 'FOOTPRINT';
  
  // Check in order of the calculation pipeline
  if (netArea < tunables.archetype_footprint_sf) {
    bindingConstraint = 'SETBACK';
  } else if (afterStormwater < tunables.archetype_footprint_sf && stormwaterReserve > 0) {
    bindingConstraint = 'STORMWATER';
  } else if (buildableArea < tunables.archetype_footprint_sf && circulationReserve > 0) {
    bindingConstraint = 'CIRCULATION';
  } else if (isCapped) {
    bindingConstraint = 'COVERAGE';
  }

  const utilizationPct = netArea > 0 ? (footprintUsed / netArea) * 100 : 0;

  return {
    steps,
    outputs: {
      total_rentable_sf: maxRentableSF,
      total_unit_count: maxUnits,
      building_count: maxBuildings,
      utilization_pct: Math.round(utilizationPct * 10) / 10,
      phase1_viable: maxBuildings >= 1,
      reverse_capacity: {
        max_units: maxUnits,
        max_rentable_sf: maxRentableSF,
        max_buildings: maxBuildings,
        binding_constraint: bindingConstraint,
      },
    },
    warnings,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for logging
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const input: SolverRunInput = await req.json();
    console.log('[SOLVER_RUN] Input received:', JSON.stringify(input, null, 2));

    // =========================================================================
    // HARD ENVELOPE GUARD — Pass 3 FAILS CLOSED without envelope_complete
    // =========================================================================
    // DOCTRINE: 
    // - No try/catch bypass
    // - No "solver defaults" allowed when blocked
    // - No Neon writes attempted
    // - No partial runs
    // =========================================================================
    if (input.envelope_complete !== true) {
      const executionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      console.error(`[SOLVER_RUN] BLOCKED: envelope_complete !== true (execution_id: ${executionId})`);
      
      // Structured log entry (EXACT FORMAT per deliverable spec)
      const blockLog = {
        pass: 3,
        status: "blocked",
        reason: "ENVELOPE_INCOMPLETE",
        county_id: input.observed?.county || null,
        execution_id: executionId,
        timestamp: timestamp,
        mode: input.mode,
        jurisdiction: input.observed?.jurisdiction || null
      };
      console.log('[SOLVER_RUN] BLOCK_LOG:', JSON.stringify(blockLog));
      
      // Log to master_failure_log for audit trail
      await supabase.from('master_failure_log').insert({
        process_id: PROCESS_ID,
        pass_number: PASS_NUMBER,
        step: 'envelope_guard',
        error_code: 'ENVELOPE_INCOMPLETE',
        error_message: 'Pass 3 requires envelope_complete=true. Solver run rejected. NO DEFAULTS COMPUTED.',
        severity: 'error',
        context: blockLog
      });

      // FAIL CLOSED — no solver logic executed, no defaults, no partial runs
      return new Response(JSON.stringify({
        solver_artifact_id: null,
        blocked: true,
        blocked_reason: 'ENVELOPE_INCOMPLETE: Jurisdiction card envelope is not complete. Fix Pass 2 data first.',
        calculation_steps: [],
        outputs: null,
        warnings: [],
        mode: input.mode,
        timestamp: timestamp,
        execution_id: executionId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Run solver based on mode
    const { steps, outputs, warnings } = input.mode === 'FORWARD'
      ? runForwardSolver(input)
      : runReverseSolver(input);

    const blocked = warnings.some(w => w.startsWith('BLOCKED:'));
    const blockedReason = blocked ? warnings.find(w => w.startsWith('BLOCKED:'))?.replace('BLOCKED: ', '') || null : null;

    const artifact: SolverArtifact = {
      solver_artifact_id: generateArtifactId(),
      mode: input.mode,
      timestamp: new Date().toISOString(),
      observed_snapshot: input.observed,
      tunables_snapshot: input.tunables,
      jurisdiction_card_snapshot: input.jurisdiction_card || null,
      calculation_steps: steps,
      outputs,
      warnings: warnings.filter(w => !w.startsWith('BLOCKED:')),
      blocked,
      blocked_reason: blockedReason,
    };

    console.log('[SOLVER_RUN] Artifact generated:', artifact.solver_artifact_id);

    return new Response(JSON.stringify(artifact), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SOLVER_RUN] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error to master_failure_log (supabase client already initialized above)
    try {
      await supabase.from('master_failure_log').insert({
        process_id: PROCESS_ID,
        pass_number: PASS_NUMBER,
        step: 'solver_execution',
        error_code: 'SOLVER_ERROR',
        error_message: message,
        severity: 'error',
        context: { error_type: error instanceof Error ? error.name : 'Unknown' }
      });
    } catch (logError) {
      console.error('[SOLVER_RUN] Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
