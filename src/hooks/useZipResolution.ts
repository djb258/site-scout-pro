import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useZipResolution(zip: string, debounceMs = 300): UseZipResolutionResult {
  const [resolution, setResolution] = useState<ZipResolution | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state if ZIP is empty or invalid format
    if (!zip || !/^\d{5}$/.test(zip)) {
      setResolution(null);
      setIsValid(false);
      setIsLoading(false);
      if (zip && zip.length > 0 && zip.length < 5) {
        setError(null); // Don't show error while typing
      } else if (zip && !/^\d{5}$/.test(zip)) {
        setError("ZIP must be exactly 5 digits");
      } else {
        setError(null);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("us_zip_codes")
          .select("zip, city, state_id, state_name, county_name, county_fips, lat, lng")
          .eq("zip", zip)
          .single();

        if (queryError || !data) {
          setResolution(null);
          setIsValid(false);
          setError("ZIP code not found");
          setIsLoading(false);
          return;
        }

        setResolution({
          zip: data.zip,
          city: data.city,
          state: data.state_id,
          stateName: data.state_name,
          county: data.county_name,
          countyFips: data.county_fips,
          lat: data.lat,
          lng: data.lng,
        });
        setIsValid(true);
        setError(null);
      } catch (err) {
        console.error("ZIP resolution error:", err);
        setResolution(null);
        setIsValid(false);
        setError("Failed to resolve ZIP code");
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [zip, debounceMs]);

  return { resolution, isLoading, isValid, error };
}
