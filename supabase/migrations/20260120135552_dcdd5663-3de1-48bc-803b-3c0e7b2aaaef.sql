-- Pass 0 Signals Table (ZIP-anchored, append-only)
CREATE TABLE pass0_signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sovereign_id TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  raw_excerpt TEXT,
  signal_strength_hint TEXT CHECK (signal_strength_hint IN ('low', 'medium', 'high')),
  signal_category_version TEXT NOT NULL DEFAULT 'v1',
  observed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX idx_pass0_signals_sva ON pass0_signals(sovereign_id);
CREATE INDEX idx_pass0_signals_zip ON pass0_signals(zip_code);
CREATE INDEX idx_pass0_signals_observed ON pass0_signals(observed_at DESC);

-- Append-only enforcement trigger (blocks UPDATE/DELETE at DB level)
CREATE OR REPLACE FUNCTION prevent_signal_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pass0_signals is append-only. UPDATE/DELETE not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pass0_signals_immutable
  BEFORE UPDATE OR DELETE ON pass0_signals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_signal_mutation();

-- RLS: Read-only for anon, writes blocked
ALTER TABLE pass0_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to signals"
  ON pass0_signals FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon - external writers use service role