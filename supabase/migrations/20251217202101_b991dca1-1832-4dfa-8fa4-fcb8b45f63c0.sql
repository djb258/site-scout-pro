-- Create hub0_event_log table for ephemeral event logging (Lovable Cloud only)
CREATE TABLE public.hub0_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hub0_event_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations for ephemeral logging (no auth required)
CREATE POLICY "Allow all for hub0_event_log" ON public.hub0_event_log FOR ALL USING (true) WITH CHECK (true);

-- Add index for process_id lookups
CREATE INDEX idx_hub0_event_log_process_id ON public.hub0_event_log(process_id);

-- Add index for recent events
CREATE INDEX idx_hub0_event_log_created_at ON public.hub0_event_log(created_at DESC);