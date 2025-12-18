-- Create competitor facilities table for rent intelligence
CREATE TABLE public.competitor_facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  county TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  phone TEXT,
  website_url TEXT,
  
  -- Rent data by unit size (per sq ft / month)
  rent_5x5 NUMERIC,
  rent_5x10 NUMERIC,
  rent_10x10 NUMERIC,
  rent_10x15 NUMERIC,
  rent_10x20 NUMERIC,
  rent_10x30 NUMERIC,
  
  -- Climate control variants
  rent_10x10_cc NUMERIC,
  rent_10x15_cc NUMERIC,
  rent_10x20_cc NUMERIC,
  
  -- Aggregate rent bands
  rent_low NUMERIC,
  rent_medium NUMERIC,
  rent_high NUMERIC,
  
  -- Facility details
  total_sqft INTEGER,
  unit_count INTEGER,
  climate_controlled BOOLEAN DEFAULT false,
  has_rv_boat BOOLEAN DEFAULT false,
  
  -- Data source tracking
  source TEXT, -- 'perplexity', 'manual', 'scrape', etc.
  source_url TEXT,
  confidence_score NUMERIC DEFAULT 0.5,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.competitor_facilities ENABLE ROW LEVEL SECURITY;

-- Public read access (competitor data is not sensitive)
CREATE POLICY "Anyone can view competitor facilities" 
ON public.competitor_facilities 
FOR SELECT 
USING (true);

-- Authenticated users can insert/update
CREATE POLICY "Authenticated users can insert competitor facilities" 
ON public.competitor_facilities 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update competitor facilities" 
ON public.competitor_facilities 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Indexes for search
CREATE INDEX idx_competitor_county ON public.competitor_facilities(county, state);
CREATE INDEX idx_competitor_zip ON public.competitor_facilities(zip_code);
CREATE INDEX idx_competitor_county_zip ON public.competitor_facilities(county, zip_code);

-- Trigger for updated_at
CREATE TRIGGER update_competitor_facilities_updated_at
BEFORE UPDATE ON public.competitor_facilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();