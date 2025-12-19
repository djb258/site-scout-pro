import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface JurisdictionCard {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string | null;
  
  // Status
  envelope_complete: boolean;
  has_fatal_prohibition: boolean;
  is_storage_allowed: 'yes' | 'no' | 'unknown';
  
  // Scope
  authority_model: string | null;
  zoning_model: string | null;
  controlling_authority_name: string | null;
  
  // Viability
  storage_allowed: string;
  fatal_prohibition: string;
  fatal_prohibition_description: string | null;
  conditional_use_required: string;
  discretionary_required: string;
  
  // Envelope (for solver)
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
  
  // Fire/Life Safety
  fire_lane_required: string;
  min_fire_lane_width: number | null;
  sprinkler_required: string;
  adopted_fire_code: string | null;
  
  // Stormwater
  detention_required: string;
  retention_required: string;
  max_impervious: number | null;
  watershed_overlay: string;
  floodplain_overlay: string;
  
  // Parking
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
  fetchCard: (countyName: string, state: string) => Promise<void>;
}

// Default values when no data available
const DEFAULT_SOLVER_CARD: SolverJurisdictionCard = {
  front_setback_ft: 50,
  side_setback_ft: 25,
  rear_setback_ft: 30,
  max_lot_coverage_pct: 60,
  stormwater_requirement_pct: 15,
  fire_lane_width_ft: 24,
};

export function useJurisdictionCard(): UseJurisdictionCardResult {
  const [card, setCard] = useState<JurisdictionCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'blocked' | 'error'>('idle');

  const fetchCard = useCallback(async (countyName: string, state: string) => {
    if (!countyName || !state) return;

    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setStatus('loading');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('pass2_get_jurisdiction_card', {
        body: { county_name: countyName, state },
      });

      if (fnError) throw fnError;

      if (data.status === 'found') {
        setCard(data.card);
        setWarnings(data.warnings || []);
        setStatus('found');
      } else if (data.status === 'blocked') {
        setCard(data.card);
        setWarnings(data.warnings || []);
        setStatus('blocked');
        setError(data.message);
      } else if (data.status === 'not_found') {
        setCard(null);
        setStatus('not_found');
        setWarnings(['Jurisdiction card not found - using defaults']);
      } else {
        setStatus('error');
        setError(data.message || 'Unknown error');
      }
    } catch (err) {
      console.error('[useJurisdictionCard] Error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to fetch jurisdiction card');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute solver card from full card or use defaults
  const solverCard: SolverJurisdictionCard = card
    ? {
        front_setback_ft: card.setback_front ?? DEFAULT_SOLVER_CARD.front_setback_ft,
        side_setback_ft: card.setback_side ?? DEFAULT_SOLVER_CARD.side_setback_ft,
        rear_setback_ft: card.setback_rear ?? DEFAULT_SOLVER_CARD.rear_setback_ft,
        max_lot_coverage_pct: card.max_lot_coverage ?? DEFAULT_SOLVER_CARD.max_lot_coverage_pct,
        stormwater_requirement_pct: card.max_impervious 
          ? (100 - card.max_impervious) 
          : DEFAULT_SOLVER_CARD.stormwater_requirement_pct,
        fire_lane_width_ft: card.min_fire_lane_width ?? DEFAULT_SOLVER_CARD.fire_lane_width_ft,
      }
    : DEFAULT_SOLVER_CARD;

  return {
    card,
    solverCard,
    isLoading,
    error,
    warnings,
    status,
    fetchCard,
  };
}
