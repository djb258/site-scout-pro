CREATE TABLE IF NOT EXISTS market_data (
  market_data_id TEXT PRIMARY KEY,
  zip_code TEXT NOT NULL,
  county_fips TEXT,
  state TEXT,
  population INTEGER,
  median_household_income REAL,
  storage_sqft_per_capita REAL,
  occupancy_estimate REAL,
  median_rent REAL,
  traffic_score REAL,
  source TEXT,
  as_of_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zip_scores (
  zip_code TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  county_fips TEXT,
  county_name TEXT,
  population INTEGER,
  median_household_income REAL,
  market_score REAL,
  signal_score REAL,
  composite_score REAL,
  pass_status TEXT NOT NULL DEFAULT 'pending',
  market_data_id TEXT,
  facility_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (market_data_id) REFERENCES market_data(market_data_id)
);

CREATE TABLE IF NOT EXISTS facilities (
  facility_id TEXT PRIMARY KEY,
  zip_code TEXT NOT NULL,
  market_data_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  latitude REAL,
  longitude REAL,
  units INTEGER,
  rentable_sqft REAL,
  occupancy_rate REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (zip_code) REFERENCES zip_scores(zip_code),
  FOREIGN KEY (market_data_id) REFERENCES market_data(market_data_id)
);

CREATE TABLE IF NOT EXISTS parcels (
  parcel_id TEXT PRIMARY KEY,
  zip_code TEXT NOT NULL,
  apn TEXT,
  county_fips TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  acreage REAL,
  zoning_code TEXT,
  flood_zone TEXT,
  shape_score REAL,
  slope_score REAL,
  access_score REAL,
  pass_status TEXT NOT NULL DEFAULT 'candidate',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (zip_code) REFERENCES zip_scores(zip_code)
);

CREATE TABLE IF NOT EXISTS deal_pipeline (
  deal_id TEXT PRIMARY KEY,
  zip_code TEXT NOT NULL,
  parcel_id TEXT,
  facility_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  stage TEXT NOT NULL DEFAULT 'pass0',
  priority TEXT,
  owner TEXT,
  target_close_date TEXT,
  notes TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (zip_code) REFERENCES zip_scores(zip_code),
  FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id),
  FOREIGN KEY (facility_id) REFERENCES facilities(facility_id)
);

CREATE TABLE IF NOT EXISTS pass_results (
  pass_result_id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  run_id TEXT,
  zip_code TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  metrics TEXT NOT NULL DEFAULT '{}',
  evaluated_at TEXT NOT NULL,
  FOREIGN KEY (deal_id) REFERENCES deal_pipeline(deal_id),
  FOREIGN KEY (zip_code) REFERENCES zip_scores(zip_code)
);

CREATE INDEX IF NOT EXISTS idx_market_data_zip_code ON market_data(zip_code);
CREATE INDEX IF NOT EXISTS idx_zip_scores_state ON zip_scores(state);
CREATE INDEX IF NOT EXISTS idx_zip_scores_status ON zip_scores(pass_status);
CREATE INDEX IF NOT EXISTS idx_facilities_zip_code ON facilities(zip_code);
CREATE INDEX IF NOT EXISTS idx_facilities_market_data_id ON facilities(market_data_id);
CREATE INDEX IF NOT EXISTS idx_parcels_zip_code ON parcels(zip_code);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(pass_status);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_zip_code ON deal_pipeline(zip_code);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_status ON deal_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_pass_results_deal_id ON pass_results(deal_id);
CREATE INDEX IF NOT EXISTS idx_pass_results_zip_stage ON pass_results(zip_code, stage);
