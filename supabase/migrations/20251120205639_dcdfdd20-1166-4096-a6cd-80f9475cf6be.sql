-- Create table for US ZIP code data
CREATE TABLE public.us_zip_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zip text NOT NULL,
  lat numeric,
  lng numeric,
  city text,
  state_id text,
  state_name text,
  zcta boolean,
  parent_zcta text,
  population integer,
  density numeric,
  county_fips text,
  county_name text,
  county_weights jsonb,
  county_names_all text,
  county_fips_all text,
  imprecise boolean,
  military boolean,
  timezone text,
  age_median numeric,
  male numeric,
  female numeric,
  married numeric,
  family_size numeric,
  income_household_median integer,
  income_household_six_figure numeric,
  home_ownership numeric,
  home_value integer,
  rent_median integer,
  education_college_or_above numeric,
  labor_force_participation numeric,
  unemployment_rate numeric,
  race_white numeric,
  race_black numeric,
  race_asian numeric,
  race_native numeric,
  race_pacific numeric,
  race_other numeric,
  race_multiple numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(zip)
);

-- Create index on zip for fast lookups
CREATE INDEX idx_us_zip_codes_zip ON public.us_zip_codes(zip);

-- Create index on state for filtering
CREATE INDEX idx_us_zip_codes_state ON public.us_zip_codes(state_id);

-- Create index on city for searching
CREATE INDEX idx_us_zip_codes_city ON public.us_zip_codes(city);

-- Enable RLS
ALTER TABLE public.us_zip_codes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public data)
CREATE POLICY "Allow all operations on us_zip_codes"
  ON public.us_zip_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);