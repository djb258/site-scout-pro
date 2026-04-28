export interface Env {
  STORAGE_OPS: D1Database;
  D1_GLOBAL: D1Database;
}

export type ZipPassStatus = 'pending' | 'passed' | 'failed';
export type ParcelPassStatus = 'candidate' | 'passed' | 'failed';
export type DealStatus = 'new' | 'active' | 'under_contract' | 'won' | 'lost';
export type DealStage = 'pass0' | 'pass1' | 'pass2' | 'pass3' | 'closed';
export type PassResultStatus = 'pending' | 'passed' | 'failed';

export interface Pagination {
  limit: number;
  offset: number;
}

export interface MarketData {
  market_data_id: string;
  zip_code: string;
  county_fips: string | null;
  state: string | null;
  population: number | null;
  median_household_income: number | null;
  storage_sqft_per_capita: number | null;
  occupancy_estimate: number | null;
  median_rent: number | null;
  traffic_score: number | null;
  source: string | null;
  as_of_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZipScore {
  zip_code: string;
  state: string;
  county_fips: string | null;
  county_name: string | null;
  population: number | null;
  median_household_income: number | null;
  market_score: number | null;
  signal_score: number | null;
  composite_score: number | null;
  pass_status: ZipPassStatus;
  market_data_id: string | null;
  facility_count: number;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  facility_id: string;
  zip_code: string;
  market_data_id: string | null;
  name: string;
  brand: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  units: number | null;
  rentable_sqft: number | null;
  occupancy_rate: number | null;
  source: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface Parcel {
  parcel_id: string;
  zip_code: string;
  apn: string | null;
  county_fips: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  acreage: number | null;
  zoning_code: string | null;
  flood_zone: string | null;
  shape_score: number | null;
  slope_score: number | null;
  access_score: number | null;
  pass_status: ParcelPassStatus;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface DealPipeline {
  deal_id: string;
  zip_code: string;
  parcel_id: string | null;
  facility_id: string | null;
  title: string;
  status: DealStatus;
  stage: DealStage;
  priority: string | null;
  owner: string | null;
  target_close_date: string | null;
  notes: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface PassResult {
  pass_result_id: string;
  deal_id: string;
  run_id: string | null;
  zip_code: string;
  stage: DealStage;
  status: PassResultStatus;
  score: number | null;
  metrics: string;
  evaluated_at: string;
}

export interface DealRecord extends Omit<DealPipeline, 'metadata'> {
  latest_stage: string | null;
  latest_status: string | null;
  latest_score: number | null;
  latest_run_id: string | null;
  metadata: unknown;
}
