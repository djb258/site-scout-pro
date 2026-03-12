// TODO: BAR-111 — rewrite to call CF Worker endpoint (was Supabase direct query on jurisdiction_card_drafts)
import { useState } from "react";

export interface JurisdictionCard {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string | null;
  envelope_complete: boolean;
  card_complete: boolean;
  has_fatal_prohibition: boolean;
  is_storage_allowed: 'yes' | 'no' | 'unknown';
  authority_model: string | null;
  zoning_model: string | null;
  controlling_authority_name: string | null;
  storage_allowed: string;
  fatal_prohibition: string;
  fatal_prohibition_description: string | null;
  conditional_use_required: string;
  discretionary_required: string;
  setback_front: number | null;
  setback_side: number | null;
  setback_rear: number | null;
  max_lot_coverage: number | null;
  max_height: number | null;
  max_stories: number | null;
  max_far: number | null;
  buffer_residential: number | null;
  buffer_waterway: number | null;
  buffer_roadway: number | null;
  fire_lane_required: string;
  min_fire_lane_width: number | null;
  sprinkler_required: string;
  adopted_fire_code: string | null;
  detention_required: string;
  retention_required: string;
  max_impervious: number | null;
  watershed_overlay: string;
  floodplain_overlay: string;
  parking_required: string;
  parking_ratio: number | null;
  parking_ratio_unit: string | null;
  truck_access_required: string;
  min_driveway_width: number | null;
}

export interface SolverJurisdictionCard {
  front_setback_ft: number;
  side_setback_ft: number;
  rear_setback_ft: number;
  max_lot_coverage_pct: number;
  stormwater_requirement_pct: number;
  fire_lane_width_ft: number;
}

interface UseJurisdictionCardResult {
  card: JurisdictionCard | null;
  solverCard: SolverJurisdictionCard;
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  status: 'idle' | 'loading' | 'found' | 'not_found' | 'blocked' | 'error';
  fetchCard: (countyNameOrId: string | number, stateCode: string) => Promise<void>;
}

const DEFAULT_SOLVER_CARD: SolverJurisdictionCard = {
  front_setback_ft: 50,
  side_setback_ft: 25,
  rear_setback_ft: 30,
  max_lot_coverage_pct: 60,
  stormwater_requirement_pct: 15,
  fire_lane_width_ft: 24,
};

export function useJurisdictionCard(): UseJurisdictionCardResult {
  const [card] = useState<JurisdictionCard | null>(null);

  // TODO: BAR-111 — migrate to CF Worker D1 query on jurisdiction_card_drafts
  return {
    card,
    solverCard: DEFAULT_SOLVER_CARD,
    isLoading: false,
    error: 'BAR-111: Supabase retired, awaiting CF Worker migration',
    warnings: ['BAR-111: Hook gutted, awaiting CF migration'],
    status: 'idle',
    fetchCard: async () => {},
  };
}
