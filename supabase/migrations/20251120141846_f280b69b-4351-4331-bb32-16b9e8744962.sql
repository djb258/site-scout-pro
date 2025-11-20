-- Create staging tables for Storage Site Go/No-Go wizard

-- Site intake staging table (Step 1)
CREATE TABLE public.site_intake_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  json_payload JSONB NOT NULL,
  state TEXT,
  county TEXT,
  zip_code TEXT,
  acreage DECIMAL,
  parcel_shape TEXT,
  slope_percent DECIMAL,
  floodplain BOOLEAN,
  access_quality TEXT,
  nearby_road_type TEXT,
  frontend_user_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Site demand staging table (Step 2)
CREATE TABLE public.site_demand_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  json_payload JSONB NOT NULL,
  site_intake_id UUID REFERENCES public.site_intake_staging(id),
  population INTEGER,
  households INTEGER,
  uhaul_migration_score TEXT,
  traffic_count INTEGER,
  competition_count INTEGER,
  frontend_user_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rent band staging table (Step 3)
CREATE TABLE public.rent_band_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  json_payload JSONB NOT NULL,
  site_intake_id UUID REFERENCES public.site_intake_staging(id),
  low_rent DECIMAL,
  medium_rent DECIMAL,
  high_rent DECIMAL,
  frontend_user_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Site results staging table (Step 5)
CREATE TABLE public.site_results_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  json_payload JSONB NOT NULL,
  site_intake_id UUID REFERENCES public.site_intake_staging(id),
  saturation_score DECIMAL,
  parcel_viability_score DECIMAL,
  county_difficulty DECIMAL,
  financial_viability DECIMAL,
  final_score DECIMAL,
  decision TEXT,
  frontend_user_id TEXT,
  status TEXT DEFAULT 'complete',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_site_intake_frontend_user ON public.site_intake_staging(frontend_user_id);
CREATE INDEX idx_site_demand_intake ON public.site_demand_staging(site_intake_id);
CREATE INDEX idx_rent_band_intake ON public.rent_band_staging(site_intake_id);
CREATE INDEX idx_site_results_intake ON public.site_results_staging(site_intake_id);
CREATE INDEX idx_site_intake_created ON public.site_intake_staging(created_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.site_intake_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_demand_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_band_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_results_staging ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now since frontend_user_id is not auth-based)
CREATE POLICY "Allow all operations on site_intake_staging" 
ON public.site_intake_staging 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on site_demand_staging" 
ON public.site_demand_staging 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on rent_band_staging" 
ON public.rent_band_staging 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on site_results_staging" 
ON public.site_results_staging 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_site_intake_staging_updated_at
BEFORE UPDATE ON public.site_intake_staging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_demand_staging_updated_at
BEFORE UPDATE ON public.site_demand_staging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rent_band_staging_updated_at
BEFORE UPDATE ON public.rent_band_staging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_results_staging_updated_at
BEFORE UPDATE ON public.site_results_staging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();