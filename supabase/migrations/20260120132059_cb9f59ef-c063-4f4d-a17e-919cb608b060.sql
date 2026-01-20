-- ============================================================
-- PASS 3: COUNTY CARD CONSTRUCTION
-- Authority Precedence: county_card_master is THE authoritative source.
-- Once a record exists here, jurisdiction_card_drafts is ignored.
-- ============================================================

-- 1. county_card_raw — Append-Only Evidence Intake
-- Raw sources have NO confidence score (doctrine: confidence is card-level)
CREATE TABLE public.county_card_raw (
  raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_fips TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('ordinance','website','pdf','call','email','manual')),
  source_url TEXT,
  raw_payload JSONB NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT now(),
  collected_by TEXT DEFAULT 'user'
);

-- Index for county lookups
CREATE INDEX idx_county_card_raw_fips ON public.county_card_raw(county_fips);

-- Enable RLS
ALTER TABLE public.county_card_raw ENABLE ROW LEVEL SECURITY;

-- Append-only: INSERT and SELECT only, no UPDATE/DELETE
CREATE POLICY "Anyone can insert raw evidence"
  ON public.county_card_raw FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view raw evidence"
  ON public.county_card_raw FOR SELECT
  USING (true);

-- 2. county_card_master — Canonical Authority
-- CONFIDENCE DOCTRINE: confidence_score is a property of the CARD, not sources.
-- Represents certainty about jurisdiction rules as a whole.
CREATE TABLE public.county_card_master (
  county_fips TEXT PRIMARY KEY,
  county_name TEXT,
  state_code TEXT,

  zoning_authority TEXT,
  permitting_authority TEXT,

  min_setback_front_ft INT,
  min_setback_side_ft INT,
  min_setback_rear_ft INT,
  max_height_ft INT,
  max_lot_coverage_pct INT,

  special_use_required BOOLEAN,
  variance_process TEXT,

  status TEXT CHECK (status IN ('draft','validated')) DEFAULT 'draft',
  
  -- Card-level confidence (0-100), NOT source-level
  confidence_score INT CHECK (confidence_score BETWEEN 0 AND 100),

  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.county_card_master ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT/UPDATE allowed, NO DELETE (immutable once created)
CREATE POLICY "Anyone can view master cards"
  ON public.county_card_master FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert master cards"
  ON public.county_card_master FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update master cards"
  ON public.county_card_master FOR UPDATE
  USING (true);

-- Auto-update updated_at trigger
CREATE TRIGGER update_county_card_master_updated_at
  BEFORE UPDATE ON public.county_card_master
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. county_card_sources — Traceability Map
-- Links master facts to raw evidence. NO confidence here.
CREATE TABLE public.county_card_sources (
  county_fips TEXT REFERENCES public.county_card_master(county_fips) ON DELETE CASCADE,
  raw_id UUID REFERENCES public.county_card_raw(raw_id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (county_fips, raw_id)
);

-- Enable RLS
ALTER TABLE public.county_card_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view source links"
  ON public.county_card_sources FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert source links"
  ON public.county_card_sources FOR INSERT
  WITH CHECK (true);