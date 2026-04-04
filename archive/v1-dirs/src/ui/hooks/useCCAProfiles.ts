// TODO: BAR-111 — rewrite to call CF Worker endpoint (was Supabase edge functions cca_get_profile + cca_dispatch_recon)
import { useState } from "react";

export interface CCAProfile {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string | null;
  pass0: {
    method: string;
    coverage: string;
    vendor: string | null;
    source_url: string | null;
    has_api: boolean;
    has_portal: boolean;
  };
  pass2: {
    method: string;
    coverage: string;
    source_url: string | null;
    planning_url: string | null;
    ordinance_url: string | null;
    zoning_map_url: string | null;
  };
  metadata: {
    confidence: string;
    verified_at: string;
    expires_at: string;
    is_expired: boolean;
    expires_soon: boolean;
    days_until_expiry: number;
    version: number;
  };
}

export interface DispatchResult {
  dispatch_id: string;
  status: 'dispatched' | 'all_fresh' | 'error';
  counties_to_recon: Array<{
    county_id: number | null;
    county_name: string;
    state: string;
    recon_type: 'full' | 'refresh' | 'partial';
    passes_needed: string[];
  }>;
  counties_fresh: string[];
  timestamp: string;
}

interface UseCCAProfilesResult {
  profiles: CCAProfile[];
  isLoading: boolean;
  error: string | null;
  fetchProfile: (countyName: string, state: string) => Promise<CCAProfile | null>;
  dispatchRecon: (zip: string, radiusMiles: number, forceRefresh?: boolean) => Promise<DispatchResult | null>;
}

export function useCCAProfiles(): UseCCAProfilesResult {
  const [profiles] = useState<CCAProfile[]>([]);

  // TODO: BAR-111 — migrate to CF Worker endpoints
  return {
    profiles,
    isLoading: false,
    error: 'BAR-111: Supabase retired, awaiting CF Worker migration',
    fetchProfile: async () => null,
    dispatchRecon: async () => null,
  };
}
