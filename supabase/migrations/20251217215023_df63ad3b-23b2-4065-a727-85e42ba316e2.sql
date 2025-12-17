-- ============================================================================
-- HUB 1 PASS 1 REFACTOR - Canonical Tables + Legacy Deprecation
-- ============================================================================

-- 1. DEPRECATE LEGACY TABLES (mark as deprecated, block new writes)
-- ============================================================================

-- Add deprecated column to pass1_runs
ALTER TABLE pass1_runs ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT true;
COMMENT ON TABLE pass1_runs IS 'LEGACY - READ ONLY. Use hub1_pass1_run_log instead.';

-- Add deprecated column to pass1_results  
ALTER TABLE pass1_results ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT true;
COMMENT ON TABLE pass1_results IS 'LEGACY - READ ONLY. Use hub1_pass1_run_log instead.';

-- Block new writes via RLS (deny INSERT/UPDATE) for pass1_runs
DROP POLICY IF EXISTS "Allow all on pass1_runs" ON pass1_runs;
CREATE POLICY "Allow read only on deprecated pass1_runs" ON pass1_runs
  FOR SELECT USING (true);

-- Block new writes via RLS (deny INSERT/UPDATE) for pass1_results
DROP POLICY IF EXISTS "Allow all operations on pass1_results" ON pass1_results;
CREATE POLICY "Allow read only on deprecated pass1_results" ON pass1_results
  FOR SELECT USING (true);

-- 2. CREATE CANONICAL TABLE: hub1_pass1_run_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS hub1_pass1_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  process_id TEXT NOT NULL DEFAULT 'hub1.pass1',
  step TEXT NOT NULL,  -- 'init' | 'zip_hydration' | 'demand_proxies' | 'competition_scan' | 'constraints' | 'scoring' | 'complete'
  status TEXT NOT NULL,  -- 'started' | 'completed' | 'failed' | 'rejected'
  metadata JSONB DEFAULT '{}',
  
  -- HARBEN SPEC FIELDS
  schema_version TEXT NOT NULL DEFAULT 'v1.0',
  scoring_weights JSONB NOT NULL DEFAULT '{"demand": 0.40, "supply": 0.35, "constraints": 0.25}',
  competition_confidence TEXT CHECK (competition_confidence IS NULL OR competition_confidence IN ('low', 'medium')),
  ttl_expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hub1_pass1_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for hub1_pass1_run_log" ON hub1_pass1_run_log;
CREATE POLICY "Allow all for hub1_pass1_run_log" ON hub1_pass1_run_log 
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hub1_pass1_run_log_run_id ON hub1_pass1_run_log(run_id);
CREATE INDEX IF NOT EXISTS idx_hub1_pass1_run_log_ttl ON hub1_pass1_run_log(ttl_expires_at);

-- 3. CREATE CANONICAL TABLE: hub1_pass1_error_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS hub1_pass1_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  process_id TEXT NOT NULL DEFAULT 'hub1.pass1',
  step TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- HARBEN SPEC FIELDS
  fatal BOOLEAN NOT NULL DEFAULT false,
  recoverable BOOLEAN NOT NULL DEFAULT true,
  ttl_expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hub1_pass1_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for hub1_pass1_error_log" ON hub1_pass1_error_log;
CREATE POLICY "Allow all for hub1_pass1_error_log" ON hub1_pass1_error_log 
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hub1_pass1_error_log_run_id ON hub1_pass1_error_log(run_id);
CREATE INDEX IF NOT EXISTS idx_hub1_pass1_error_log_ttl ON hub1_pass1_error_log(ttl_expires_at);