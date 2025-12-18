-- Pass0 Narrative Pins Scratch Store
CREATE TABLE public.pass0_narrative_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  source_id TEXT NOT NULL,
  raw_title TEXT NOT NULL,
  raw_url TEXT,
  lat NUMERIC,
  lon NUMERIC,
  zip_id TEXT,
  confidence TEXT DEFAULT 'low',
  ttl TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days'),
  resolution_tier TEXT DEFAULT 'zip',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pass0 Run Log for step tracking
CREATE TABLE public.pass0_run_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  item_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  kill_switch BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pass0_narrative_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass0_run_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all for internal system use)
CREATE POLICY "Allow all for pass0_narrative_pins"
ON public.pass0_narrative_pins
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all for pass0_run_log"
ON public.pass0_run_log
FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_pass0_narrative_pins_run_id ON public.pass0_narrative_pins(run_id);
CREATE INDEX idx_pass0_narrative_pins_zip ON public.pass0_narrative_pins(zip_id);
CREATE INDEX idx_pass0_run_log_run_id ON public.pass0_run_log(run_id);