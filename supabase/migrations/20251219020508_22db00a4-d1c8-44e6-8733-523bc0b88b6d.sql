-- Create ai_cost_tracker table for kill switch logic
CREATE TABLE public.ai_cost_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  service TEXT NOT NULL, -- 'lovable_ai', 'firecrawl', 'retell', 'overpass'
  operation TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_cost_tracker ENABLE ROW LEVEL SECURITY;

-- Allow all operations (internal system table)
CREATE POLICY "Allow all for ai_cost_tracker" ON public.ai_cost_tracker
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for fast run_id lookups
CREATE INDEX idx_ai_cost_tracker_run_id ON public.ai_cost_tracker(run_id);

-- Create index for service filtering
CREATE INDEX idx_ai_cost_tracker_service ON public.ai_cost_tracker(service);