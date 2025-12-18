-- Pass 1 Census Snapshot table (evidence per run)
CREATE TABLE IF NOT EXISTS pass1_census_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  zip_code TEXT NOT NULL,
  population INTEGER,
  housing_units INTEGER,
  vacancy_rate NUMERIC,
  vintage_year INTEGER DEFAULT 2023,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(run_id, zip_code)
);

CREATE INDEX IF NOT EXISTS idx_pass1_census_run ON pass1_census_snapshot(run_id);
CREATE INDEX IF NOT EXISTS idx_pass1_census_zip ON pass1_census_snapshot(zip_code);

ALTER TABLE pass1_census_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pass1_census_snapshot" ON pass1_census_snapshot 
  FOR ALL USING (true) WITH CHECK (true);

-- Pass 1 Demand Aggregation table (output per band)
CREATE TABLE IF NOT EXISTS pass1_demand_agg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  origin_zip TEXT NOT NULL,
  distance_band TEXT NOT NULL,
  zip_count INTEGER NOT NULL,
  population_total INTEGER NOT NULL,
  baseline_demand_sqft NUMERIC NOT NULL,
  demand_per_acre_sqft NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pass1_demand_agg_run ON pass1_demand_agg(run_id);

ALTER TABLE pass1_demand_agg ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pass1_demand_agg" ON pass1_demand_agg 
  FOR ALL USING (true) WITH CHECK (true);