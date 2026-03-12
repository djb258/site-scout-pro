// TODO: BAR-111 — rewrite to call CF Worker endpoint (was Supabase direct query)
import { useState } from "react";

export interface ZipResolution {
  zip: string;
  city: string | null;
  state: string | null;
  stateName: string | null;
  county: string | null;
  countyFips: string | null;
  lat: number | null;
  lng: number | null;
}

export interface UseZipResolutionResult {
  resolution: ZipResolution | null;
  isLoading: boolean;
  isValid: boolean;
  error: string | null;
}

export function useZipResolution(_zip: string, _debounceMs = 300): UseZipResolutionResult {
  const [resolution] = useState<ZipResolution | null>(null);

  // TODO: BAR-111 — migrate to CF Worker D1 query
  return { resolution, isLoading: false, isValid: false, error: 'BAR-111: Supabase retired, awaiting CF Worker migration' };
}
