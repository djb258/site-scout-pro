-- STEP 1: Create read-only ZIP replica table
CREATE TABLE IF NOT EXISTS ref_zip_replica (
  zip TEXT PRIMARY KEY,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  source_version TEXT NOT NULL DEFAULT 'v1.0.0',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ref_zip_replica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only for ref_zip_replica" ON ref_zip_replica FOR SELECT USING (true);

-- STEP 2: Create skip log table
CREATE TABLE IF NOT EXISTS pass1_skip_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  process_id TEXT NOT NULL DEFAULT 'hub1.pass1.radius',
  zip TEXT NOT NULL,
  skip_reason TEXT NOT NULL,
  expected_version TEXT,
  actual_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pass1_skip_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pass1_skip_log" ON pass1_skip_log FOR ALL USING (true) WITH CHECK (true);

-- STEP 3: Create radius output table
CREATE TABLE IF NOT EXISTS pass1_radius_zip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  origin_zip TEXT NOT NULL,
  zip TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  distance_miles NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pass1_radius_zip_run ON pass1_radius_zip(run_id);
CREATE INDEX IF NOT EXISTS idx_pass1_radius_zip_distance ON pass1_radius_zip(distance_miles);

ALTER TABLE pass1_radius_zip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pass1_radius_zip" ON pass1_radius_zip FOR ALL USING (true) WITH CHECK (true);

-- STEP 4: Seed ref_zip_replica from us_zip_codes
INSERT INTO ref_zip_replica (zip, lat, lng, source_version, synced_at)
SELECT zip, lat, lng, 'v1.0.0', now()
FROM us_zip_codes
WHERE lat IS NOT NULL AND lng IS NOT NULL
ON CONFLICT (zip) DO NOTHING;