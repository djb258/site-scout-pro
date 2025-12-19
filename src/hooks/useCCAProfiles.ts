import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [profiles, setProfiles] = useState<CCAProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (countyName: string, state: string): Promise<CCAProfile | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cca_get_profile', {
        body: { county_name: countyName, state },
      });

      if (fnError) throw fnError;

      if (data.status === 'found' && data.profile) {
        const profile = data.profile as CCAProfile;
        
        // Add to profiles list if not already present
        setProfiles(prev => {
          const exists = prev.some(p => p.county_id === profile.county_id);
          if (exists) {
            return prev.map(p => p.county_id === profile.county_id ? profile : p);
          }
          return [...prev, profile];
        });
        
        return profile;
      }
      
      return null;
    } catch (err) {
      console.error('[useCCAProfiles] Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dispatchRecon = useCallback(async (
    zip: string, 
    radiusMiles: number, 
    forceRefresh = false
  ): Promise<DispatchResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cca_dispatch_recon', {
        body: { 
          zip, 
          radius_miles: radiusMiles,
          force_refresh: forceRefresh,
          passes_needed: ['pass0', 'pass2'],
        },
      });

      if (fnError) throw fnError;

      // Fetch profiles for fresh counties
      if (data.counties_fresh && data.counties_fresh.length > 0) {
        for (const countyKey of data.counties_fresh) {
          const [countyName, state] = countyKey.split('_');
          if (countyName && state) {
            await fetchProfile(countyName, state);
          }
        }
      }

      return data as DispatchResult;
    } catch (err) {
      console.error('[useCCAProfiles] Error dispatching recon:', err);
      setError(err instanceof Error ? err.message : 'Failed to dispatch recon');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  return {
    profiles,
    isLoading,
    error,
    fetchProfile,
    dispatchRecon,
  };
}
