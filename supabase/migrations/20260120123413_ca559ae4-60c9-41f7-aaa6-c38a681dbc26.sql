-- =====================================================
-- PASS 1: MARKET SUPPLY DISCOVERY SCHEMA
-- ZIP-Anchored, SVA-Contextual
-- =====================================================

-- 1. facility_raw (Append-Only Intake)
CREATE TABLE public.facility_raw (
  raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code TEXT NOT NULL,
  facility_name_raw TEXT NOT NULL,
  address_raw TEXT NOT NULL,
  phone_raw TEXT,
  website_url_raw TEXT,
  source TEXT DEFAULT 'manual',
  discovery_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_raw ENABLE ROW LEVEL SECURITY;

-- Append-only: INSERT and SELECT only (no UPDATE/DELETE)
CREATE POLICY "Allow insert on facility_raw" 
  ON public.facility_raw 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow select on facility_raw" 
  ON public.facility_raw 
  FOR SELECT 
  USING (true);

-- 2. facility_master (Canonical Record)
CREATE TABLE public.facility_master (
  facility_id TEXT PRIMARY KEY,
  zip_code TEXT NOT NULL,
  facility_name TEXT,
  address TEXT NOT NULL,
  phone TEXT,
  website_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  first_seen_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_master ENABLE ROW LEVEL SECURITY;

-- SELECT, INSERT, UPDATE only (no DELETE - status toggle only)
CREATE POLICY "Allow select on facility_master" 
  ON public.facility_master 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow insert on facility_master" 
  ON public.facility_master 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow update on facility_master" 
  ON public.facility_master 
  FOR UPDATE 
  USING (true);

-- 3. facility_unit_pricing (Schema Only - Pass 2+)
CREATE TABLE public.facility_unit_pricing (
  unit_price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT REFERENCES public.facility_master(facility_id),
  unit_width_ft INT,
  unit_length_ft INT,
  unit_sqft INT,
  monthly_price NUMERIC,
  unit_type TEXT CHECK (unit_type IN ('climate', 'non_climate')),
  availability_count INT,
  source TEXT,
  confidence_score INT,
  effective_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_unit_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on facility_unit_pricing" 
  ON public.facility_unit_pricing 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 4. facility_totals (Schema Only - Pass 2+)
CREATE TABLE public.facility_totals (
  facility_id TEXT PRIMARY KEY REFERENCES public.facility_master(facility_id),
  total_rentable_sqft INT,
  total_unit_count INT,
  calculation_method TEXT,
  confidence_score INT,
  last_updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on facility_totals" 
  ON public.facility_totals 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_facility_raw_zip ON public.facility_raw(zip_code);
CREATE INDEX idx_facility_raw_created ON public.facility_raw(created_at DESC);
CREATE INDEX idx_facility_master_zip ON public.facility_master(zip_code);
CREATE INDEX idx_facility_master_status ON public.facility_master(status);
CREATE INDEX idx_facility_unit_pricing_facility ON public.facility_unit_pricing(facility_id);