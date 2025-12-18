-- Hub 1.5 Remediation Worker Shell Tables
-- Version: v0.1.0 (SHELL ONLY)
-- Purpose: Ephemeral workspace for rate remediation gaps

-- ================================================================
-- Table: pass_1_5_gap_queue (Lovable Cloud — ephemeral)
-- Tracks gaps from Pass 1 requiring remediation
-- ================================================================
CREATE TABLE pass_1_5_gap_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  pass1_run_id UUID NOT NULL,
  gap_type TEXT NOT NULL,           -- 'missing_rate', 'low_confidence', 'no_phone'
  competitor_id TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  competitor_address TEXT,
  phone_number TEXT,
  target_unit_sizes TEXT[],
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'failed', 'killed')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  assigned_worker TEXT,             -- 'scraper', 'ai_caller'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  ttl_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- ================================================================
-- Table: pass_1_5_attempt_log (Lovable Cloud — audit trail)
-- Records every remediation attempt for observability
-- ================================================================
CREATE TABLE pass_1_5_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_queue_id UUID REFERENCES pass_1_5_gap_queue(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  worker_type TEXT NOT NULL CHECK (worker_type IN ('scraper', 'ai_caller', 'manual')),
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'timeout', 'killed', 'cost_exceeded')),
  duration_ms INTEGER,
  cost_cents INTEGER DEFAULT 0,     -- estimated cost tracking
  error_code TEXT,
  error_message TEXT,
  transcript_hash TEXT,             -- SHA256 of transcript for audit
  source_url TEXT,                  -- for scraper attempts
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================================
-- Indexes for dashboard queries
-- ================================================================
CREATE INDEX idx_gap_queue_status ON pass_1_5_gap_queue(status);
CREATE INDEX idx_gap_queue_run_id ON pass_1_5_gap_queue(run_id);
CREATE INDEX idx_gap_queue_pass1_run_id ON pass_1_5_gap_queue(pass1_run_id);
CREATE INDEX idx_gap_queue_ttl ON pass_1_5_gap_queue(ttl_expires_at);
CREATE INDEX idx_attempt_log_gap_queue_id ON pass_1_5_attempt_log(gap_queue_id);
CREATE INDEX idx_attempt_log_run_id ON pass_1_5_attempt_log(run_id);
CREATE INDEX idx_attempt_log_status ON pass_1_5_attempt_log(status);
CREATE INDEX idx_attempt_log_created_at ON pass_1_5_attempt_log(created_at);

-- ================================================================
-- RLS Policies (internal service use — allow all)
-- ================================================================
ALTER TABLE pass_1_5_gap_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_1_5_attempt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for pass_1_5_gap_queue"
ON pass_1_5_gap_queue
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all for pass_1_5_attempt_log"
ON pass_1_5_attempt_log
FOR ALL
USING (true)
WITH CHECK (true);

-- ================================================================
-- Trigger for updated_at on gap_queue
-- ================================================================
CREATE TRIGGER update_pass_1_5_gap_queue_updated_at
BEFORE UPDATE ON pass_1_5_gap_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();