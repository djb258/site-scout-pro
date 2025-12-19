-- Create master_failure_log table for centralized error tracking
CREATE TABLE IF NOT EXISTS public.master_failure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id TEXT NOT NULL,
  pass_number INTEGER NOT NULL,
  run_id UUID,
  step TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT,
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_failure_log_pass ON public.master_failure_log(pass_number);
CREATE INDEX IF NOT EXISTS idx_failure_log_run ON public.master_failure_log(run_id);
CREATE INDEX IF NOT EXISTS idx_failure_log_severity ON public.master_failure_log(severity);
CREATE INDEX IF NOT EXISTS idx_failure_log_resolved ON public.master_failure_log(resolved);
CREATE INDEX IF NOT EXISTS idx_failure_log_created ON public.master_failure_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.master_failure_log ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations (internal system use)
CREATE POLICY "Allow all for master_failure_log" ON public.master_failure_log
  FOR ALL USING (true) WITH CHECK (true);