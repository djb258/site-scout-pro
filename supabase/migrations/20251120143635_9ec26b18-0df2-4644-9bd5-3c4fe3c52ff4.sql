-- Create generic ingest log table for capturing any payload from UI
CREATE TABLE IF NOT EXISTS public.generic_ingest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generic_ingest_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations (generic relay - adjust based on your security needs)
CREATE POLICY "Allow all operations on generic_ingest_log"
ON public.generic_ingest_log
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries on created_at
CREATE INDEX IF NOT EXISTS idx_generic_ingest_log_created_at 
ON public.generic_ingest_log(created_at DESC);