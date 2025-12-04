-- =============================================
-- SCRATCHPAD SCHEMA FOR PASS1 → PASS2 → VAULT
-- =============================================

-- 1. pass1_runs - Temporary container for Pass 1 scrapes
CREATE TABLE public.pass1_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip TEXT NOT NULL,
  toggles JSONB DEFAULT '{}'::jsonb,
  radius_counties JSONB DEFAULT '[]'::jsonb,
  gemini_facilities JSONB DEFAULT '[]'::jsonb,
  gemini_housing JSONB DEFAULT '[]'::jsonb,
  gemini_anchors JSONB DEFAULT '[]'::jsonb,
  gemini_recreation JSONB DEFAULT '[]'::jsonb,
  gemini_industry_news JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. pass2_runs - Temporary container for Pass 2 scrapes
CREATE TABLE public.pass2_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pass1_id UUID REFERENCES public.pass1_runs(id) ON DELETE CASCADE,
  zoning_intel JSONB DEFAULT '{}'::jsonb,
  permit_intel JSONB DEFAULT '{}'::jsonb,
  industrial_deep_dive JSONB DEFAULT '{}'::jsonb,
  housing_pipeline JSONB DEFAULT '[]'::jsonb,
  fusion_model JSONB DEFAULT '{}'::jsonb,
  feasibility JSONB DEFAULT '{}'::jsonb,
  reverse_feasibility JSONB DEFAULT '{}'::jsonb,
  rent_benchmarks JSONB DEFAULT '{}'::jsonb,
  verdict JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. calculators_state - User-adjustable calculator parameters
CREATE TABLE public.calculators_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metal_cost_sqft NUMERIC DEFAULT 0,
  concrete_cost_yd NUMERIC DEFAULT 0,
  concrete_finish_cost NUMERIC DEFAULT 0,
  land_cost_per_acre NUMERIC DEFAULT 0,
  cap_rate_target NUMERIC DEFAULT 0,
  market_rent_10x10 NUMERIC DEFAULT 0,
  market_rent_10x20 NUMERIC DEFAULT 0,
  acres_available NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. engine_logs - Tracks tool calls from Claude, Replit, Deerflow, etc.
CREATE TABLE public.engine_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engine TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. staging_payload - Temporary JSON blob for Pass 2 output
CREATE TABLE public.staging_payload (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pass2_id UUID REFERENCES public.pass2_runs(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. vault_push_queue - Queue of finalized packages awaiting Neon vault write
CREATE TABLE public.vault_push_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staging_id UUID REFERENCES public.staging_payload(id) ON DELETE CASCADE,
  neon_payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.pass1_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass2_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculators_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_payload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_push_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for scratchpad - no auth required)
CREATE POLICY "Allow all on pass1_runs" ON public.pass1_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pass2_runs" ON public.pass2_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on calculators_state" ON public.calculators_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on engine_logs" ON public.engine_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on staging_payload" ON public.staging_payload FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on vault_push_queue" ON public.vault_push_queue FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_pass1_runs_zip ON public.pass1_runs(zip);
CREATE INDEX idx_pass1_runs_status ON public.pass1_runs(status);
CREATE INDEX idx_pass2_runs_pass1_id ON public.pass2_runs(pass1_id);
CREATE INDEX idx_pass2_runs_status ON public.pass2_runs(status);
CREATE INDEX idx_engine_logs_engine ON public.engine_logs(engine);
CREATE INDEX idx_vault_push_queue_status ON public.vault_push_queue(status);

-- Updated_at triggers
CREATE TRIGGER update_pass1_runs_updated_at BEFORE UPDATE ON public.pass1_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pass2_runs_updated_at BEFORE UPDATE ON public.pass2_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_calculators_state_updated_at BEFORE UPDATE ON public.calculators_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vault_push_queue_updated_at BEFORE UPDATE ON public.vault_push_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();