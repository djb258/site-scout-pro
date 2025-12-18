-- Pass 1 Supply Gap Spoke Tables (Cloud-only, ephemeral)
-- VERSION: v1.0.0

-- Table 1: Individual facility snapshots
CREATE TABLE IF NOT EXISTS pass1_supply_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  zip TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  estimated_sqft NUMERIC NOT NULL,
  source TEXT NOT NULL,        -- 'mock' | 'google' | 'osm' | 'manual'
  confidence TEXT NOT NULL,    -- 'low' | 'medium' (NEVER 'high')
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table 2: Aggregated supply and gap per distance band
CREATE TABLE IF NOT EXISTS pass1_supply_agg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  distance_band TEXT NOT NULL,     -- '0-30' | '30-60' | '60-120'
  facility_count INTEGER NOT NULL,
  supply_sqft_total NUMERIC NOT NULL,
  gap_sqft NUMERIC NOT NULL,
  confidence TEXT NOT NULL,        -- lowest confidence in band
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE pass1_supply_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass1_supply_agg ENABLE ROW LEVEL SECURITY;

-- RLS Policies (cloud-only, allow all)
CREATE POLICY "Allow all for pass1_supply_snapshot"
  ON pass1_supply_snapshot FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for pass1_supply_agg"
  ON pass1_supply_agg FOR ALL USING (true) WITH CHECK (true);

-- Indexes for efficient queries
CREATE INDEX idx_pass1_supply_snapshot_run_id ON pass1_supply_snapshot(run_id);
CREATE INDEX idx_pass1_supply_agg_run_id ON pass1_supply_agg(run_id);