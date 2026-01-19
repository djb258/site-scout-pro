-- Create table for counties within SVA radius
CREATE TABLE public.sovereign_id_counties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sva_id TEXT NOT NULL,
  county_name TEXT NOT NULL,
  county_fips TEXT NOT NULL,
  state_id TEXT NOT NULL,
  min_distance_miles NUMERIC NOT NULL,
  zip_count INTEGER NOT NULL DEFAULT 1,
  total_population INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX idx_sovereign_id_counties_sva_id ON public.sovereign_id_counties(sva_id);

-- Add unique constraint to prevent duplicates
ALTER TABLE public.sovereign_id_counties 
ADD CONSTRAINT unique_sva_county UNIQUE (sva_id, county_fips);

-- Enable RLS
ALTER TABLE public.sovereign_id_counties ENABLE ROW LEVEL SECURITY;

-- Allow reads
CREATE POLICY "Anyone can read sovereign_id_counties" 
ON public.sovereign_id_counties 
FOR SELECT 
USING (true);

-- Allow inserts (from edge functions)
CREATE POLICY "Anyone can insert sovereign_id_counties" 
ON public.sovereign_id_counties 
FOR INSERT 
WITH CHECK (true);