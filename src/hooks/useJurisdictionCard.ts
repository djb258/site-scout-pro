import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Jurisdiction Card Hook — reads from Supabase staging (NOT Neon)
 * 
 * DOCTRINE: Supabase stages working truth. This hook reads drafts directly.
 * No edge function required for reads — Supabase handles it.
 */

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
  fetchCard: (countyNameOrId: string | number, stateCode: string) => Promise<void>;
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

/**
 * Extract card fields from staging draft payload
 */
function mapDraftToCard(draft: {
  county_id: number;
  state_code: string;
  envelope_complete: boolean;
  fatal_prohibition: string;
  card_payload: Record<string, unknown>;
}): JurisdictionCard {
  const p = draft.card_payload;
  
  return {
    county_id: draft.county_id,
    state: draft.state_code,
    county_name: (p.county_name as string) || `County ${draft.county_id}`,
    county_fips: (p.county_fips as string) || null,
    
    envelope_complete: draft.envelope_complete,
    has_fatal_prohibition: draft.fatal_prohibition === 'yes',
    is_storage_allowed: (p.storage_allowed as 'yes' | 'no' | 'unknown') || 'unknown',
    
    authority_model: (p.authority_model as string) || null,
    zoning_model: (p.zoning_model as string) || null,
    controlling_authority_name: (p.controlling_authority_name as string) || null,
    
    storage_allowed: (p.storage_allowed as string) || 'unknown',
    fatal_prohibition: draft.fatal_prohibition,
    fatal_prohibition_description: (p.fatal_prohibition_description as string) || null,
    conditional_use_required: (p.conditional_use_required as string) || 'unknown',
    discretionary_required: (p.discretionary_required as string) || 'unknown',
    
    setback_front: (p.setback_front as number) || null,
    setback_side: (p.setback_side as number) || null,
    setback_rear: (p.setback_rear as number) || null,
    max_lot_coverage: (p.max_lot_coverage as number) || null,
    max_height: (p.max_height as number) || null,
    max_stories: (p.max_stories as number) || null,
    max_far: (p.max_far as number) || null,
    buffer_residential: (p.landscape_buffer as number) || null,
    buffer_waterway: null,
    buffer_roadway: null,
    
    fire_lane_required: (p.fire_access_width as number) ? 'yes' : 'unknown',
    min_fire_lane_width: (p.fire_access_width as number) || null,
    sprinkler_required: (p.fire_sprinkler_required as string) || 'unknown',
    adopted_fire_code: null,
    
    detention_required: (p.stormwater_detention_required as string) || 'unknown',
    retention_required: (p.stormwater_retention_required as string) || 'unknown',
    max_impervious: (p.impervious_limit_percent as number) || null,
    watershed_overlay: 'unknown',
    floodplain_overlay: 'unknown',
    
    parking_required: (p.parking_spaces_required as number) ? 'yes' : 'unknown',
    parking_ratio: (p.parking_ratio as number) || null,
    parking_ratio_unit: 'per 1000 sqft',
    truck_access_required: 'unknown',
    min_driveway_width: null,
  };
}

export function useJurisdictionCard(): UseJurisdictionCardResult {
  const [card, setCard] = useState<JurisdictionCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'blocked' | 'error'>('idle');

  const fetchCard = useCallback(async (countyNameOrId: string | number, stateCode: string) => {
    if (!countyNameOrId || !stateCode) return;

    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setStatus('loading');

    try {
      // Read directly from Supabase staging table (NO edge function needed)
      // Support both county_id (number) and county_name (string) lookups
      const { data: drafts, error: queryError } = await supabase
        .from('jurisdiction_card_drafts')
        .select('*')
        .eq('state_code', stateCode)
        .in('status', ['validated', 'promoted'])
        .order('collected_at', { ascending: false })
        .limit(10);

      if (queryError) throw queryError;

      // Filter results based on input type
      let matchedDraft = null;
      if (drafts && drafts.length > 0) {
        if (typeof countyNameOrId === 'number') {
          matchedDraft = drafts.find(d => d.county_id === countyNameOrId) || null;
        } else {
          // For string lookup, check card_payload.county_name or just take first match for state
          matchedDraft = drafts.find(d => {
            const payload = d.card_payload as Record<string, unknown>;
            const countyName = (payload?.county_name as string)?.toLowerCase();
            return countyName === countyNameOrId.toLowerCase();
          }) || drafts[0]; // Fallback to first result for state
        }
      }

      if (matchedDraft) {
        const mappedCard = mapDraftToCard({
          county_id: matchedDraft.county_id,
          state_code: matchedDraft.state_code,
          envelope_complete: matchedDraft.envelope_complete,
          fatal_prohibition: matchedDraft.fatal_prohibition as string,
          card_payload: matchedDraft.card_payload as Record<string, unknown>,
        });

        setCard(mappedCard);

        // Generate warnings
        const newWarnings: string[] = [];
        if (!matchedDraft.envelope_complete) {
          newWarnings.push('Envelope incomplete - some required fields missing');
        }
        if (matchedDraft.fatal_prohibition === 'yes') {
          newWarnings.push('Fatal prohibition detected');
          setStatus('blocked');
          setError('Storage not allowed in this jurisdiction');
        } else {
          setStatus('found');
        }
        
        const redFlags = matchedDraft.red_flags as string[] || [];
        if (redFlags.length > 0) {
          newWarnings.push(...redFlags);
        }
        
        setWarnings(newWarnings);
      } else {
        // No validated/promoted draft found
        setCard(null);
        setStatus('not_found');
        setWarnings(['No jurisdiction card found - using defaults']);
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
