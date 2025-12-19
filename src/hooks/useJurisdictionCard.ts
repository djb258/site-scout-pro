import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useJurisdictionCard Hook
 * 
 * READ-ONLY, SUPABASE-FIRST jurisdiction card retrieval.
 * Queries jurisdiction_card_drafts staging table directly.
 * 
 * IMPORTANT: This hook exposes BOTH envelope_complete and card_complete:
 * - envelope_complete: Required fields for solver calculations are known
 * - card_complete: All fields researched (known OR blocked)
 * 
 * No Neon reach-around - gravity flip is complete.
 * 
 * STRUCTURAL COLUMNS: county_name is a first-class column (not card_payload).
 * CI enforces no card_payload identity field access.
 */

export interface JurisdictionCard {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string | null;
  
  // Status - both completeness flags exposed
  envelope_complete: boolean;
  card_complete: boolean; // All fields researched (known OR blocked)
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

/**
 * SolverJurisdictionCard — SOLVER ARTIFACT ONLY
 * 
 * WARNING: These defaults are for solver calculations, NOT jurisdiction truth.
 * Do NOT use these values for UI display or Pass 3 decision logic
 * without explicit envelope_complete/card_complete validation.
 * 
 * If card_complete=false or envelope_complete=false, these values
 * may be defaults, not actual researched jurisdiction requirements.
 */
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

/**
 * DEFAULT_SOLVER_CARD — SOLVER ARTIFACT, NOT JURISDICTION TRUTH
 * 
 * These are fallback values when no jurisdiction data exists.
 * Pass 3 logic MUST check envelope_complete before trusting solver outputs.
 */
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
  county_name: string | null; // STRUCTURAL: First-class column
  state_code: string;
  envelope_complete: boolean;
  card_complete: boolean;
  fatal_prohibition: string;
  card_payload: Record<string, unknown>;
}): JurisdictionCard {
  const p = draft.card_payload;
  
  return {
    county_id: draft.county_id,
    state: draft.state_code,
    county_name: draft.county_name || `County ${draft.county_id}`, // STRUCTURAL column, not payload
    county_fips: (p.county_fips as string) || null,
    
    envelope_complete: draft.envelope_complete,
    card_complete: draft.card_complete,
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
      // Uses composite index: idx_jc_drafts_lookup, idx_jc_drafts_county_name_structural
      let query = supabase
        .from('jurisdiction_card_drafts')
        .select('*')
        .eq('state_code', stateCode)
        .in('status', ['validated', 'promoted'])
        .order('collected_at', { ascending: false });

      // Use appropriate lookup based on input type (STRUCTURAL columns only)
      if (typeof countyNameOrId === 'number') {
        // Direct county_id lookup (authoritative)
        query = query.eq('county_id', countyNameOrId);
      } else {
        // STRUCTURAL column lookup (CI-enforced, not payload spelunking)
        query = query.ilike('county_name', `%${countyNameOrId}%`);
      }

      const { data: drafts, error: queryError } = await query.limit(10);

      if (queryError) throw queryError;

      // Use first match (already ordered by collected_at DESC)
      const matchedDraft = drafts?.[0] || null;

      if (matchedDraft) {
        const mappedCard = mapDraftToCard({
          county_id: matchedDraft.county_id,
          county_name: matchedDraft.county_name as string | null,
          state_code: matchedDraft.state_code,
          envelope_complete: matchedDraft.envelope_complete ?? false,
          card_complete: matchedDraft.card_complete ?? false,
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
