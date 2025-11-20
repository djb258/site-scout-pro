import { supabase } from "@/integrations/supabase/client";
import { LocationData, DemandData, RentData, ScoringResult } from "@/types/wizard";

export async function saveLocationData(data: LocationData, userId: string) {
  const payload = {
    json_payload: data as unknown as any,
    state: data.state,
    county: data.county,
    zip_code: data.zipCode,
    acreage: data.acreage,
    parcel_shape: data.parcelShape,
    slope_percent: data.slopePercent,
    floodplain: data.floodplain,
    access_quality: data.accessQuality,
    nearby_road_type: data.nearbyRoadType,
    frontend_user_id: userId,
    status: 'draft',
  };

  const { data: result, error } = await supabase
    .from('site_intake_staging')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function saveDemandData(data: DemandData, siteIntakeId: string, userId: string) {
  const payload = {
    json_payload: data as unknown as any,
    site_intake_id: siteIntakeId,
    population: data.population,
    households: data.households,
    uhaul_migration_score: data.uhaulMigrationScore,
    traffic_count: data.trafficCount,
    competition_count: data.competitionCount,
    frontend_user_id: userId,
    status: 'draft',
  };

  const { data: result, error } = await supabase
    .from('site_demand_staging')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function saveRentData(data: RentData, siteIntakeId: string, userId: string) {
  const payload = {
    json_payload: data as unknown as any,
    site_intake_id: siteIntakeId,
    low_rent: data.lowRent,
    medium_rent: data.mediumRent,
    high_rent: data.highRent,
    frontend_user_id: userId,
    status: 'draft',
  };

  const { data: result, error } = await supabase
    .from('rent_band_staging')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function saveResultData(data: ScoringResult, siteIntakeId: string, userId: string) {
  const payload = {
    json_payload: data as unknown as any,
    site_intake_id: siteIntakeId,
    saturation_score: data.saturationScore,
    parcel_viability_score: data.parcelViabilityScore,
    county_difficulty: data.countyDifficulty,
    financial_viability: data.financialViability,
    final_score: data.finalScore,
    decision: data.decision,
    frontend_user_id: userId,
    status: 'complete',
  };

  const { data: result, error } = await supabase
    .from('site_results_staging')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return result;
}
