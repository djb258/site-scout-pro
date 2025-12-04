-- Storage Viability Engine - Temporary Workbench Tables

-- 1. zip_runs - Stores each user request + toggles
CREATE TABLE public.zip_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_code TEXT NOT NULL,
    urban_exclude BOOLEAN DEFAULT false,
    multifamily_priority BOOLEAN DEFAULT false,
    recreation_load BOOLEAN DEFAULT false,
    industrial_momentum BOOLEAN DEFAULT false,
    analysis_mode TEXT DEFAULT 'build' CHECK (analysis_mode IN ('build', 'buy', 'compare')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pass1_complete', 'pass2_complete', 'reviewed', 'saved')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. pass1_results - Stores full Pass-1 output
CREATE TABLE public.pass1_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_run_id UUID NOT NULL REFERENCES public.zip_runs(id) ON DELETE CASCADE,
    zip_metadata JSONB DEFAULT '{}',
    radius_counties JSONB DEFAULT '[]',
    competitors JSONB DEFAULT '[]',
    housing_signals JSONB DEFAULT '{}',
    anchors JSONB DEFAULT '[]',
    rv_lake_signals JSONB DEFAULT '{}',
    industrial_signals JSONB DEFAULT '{}',
    analysis_summary JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. pass2_results - Stores deep-dive content
CREATE TABLE public.pass2_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_run_id UUID NOT NULL REFERENCES public.zip_runs(id) ON DELETE CASCADE,
    zoning JSONB DEFAULT '{}',
    permit_intel JSONB DEFAULT '{}',
    industrial_deep JSONB DEFAULT '{}',
    housing_pipeline JSONB DEFAULT '{}',
    fusion_model JSONB DEFAULT '{}',
    feasibility JSONB DEFAULT '{}',
    reverse_feasibility JSONB DEFAULT '{}',
    rent_benchmarks JSONB DEFAULT '{}',
    verdict JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zip_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass1_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass2_results ENABLE ROW LEVEL SECURITY;

-- Public access policies (temporary workbench - no auth required)
CREATE POLICY "Allow all operations on zip_runs" ON public.zip_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on pass1_results" ON public.pass1_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on pass2_results" ON public.pass2_results FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_zip_runs_zip_code ON public.zip_runs(zip_code);
CREATE INDEX idx_zip_runs_status ON public.zip_runs(status);
CREATE INDEX idx_pass1_results_zip_run_id ON public.pass1_results(zip_run_id);
CREATE INDEX idx_pass2_results_zip_run_id ON public.pass2_results(zip_run_id);

-- Trigger for updated_at
CREATE TRIGGER update_zip_runs_updated_at
BEFORE UPDATE ON public.zip_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();