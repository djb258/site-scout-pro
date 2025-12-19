-- Phase 1: Create Supabase Staging Tables for Jurisdiction Card Collection
-- execution_id is the PRIMARY TRACE KEY throughout the system

-- 1.1 Create jurisdiction_card_drafts table
CREATE TABLE public.jurisdiction_card_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL UNIQUE,  -- PRIMARY TRACE KEY
  county_id INTEGER NOT NULL,
  state_code TEXT NOT NULL,
  asset_class TEXT DEFAULT 'self_storage' CHECK (asset_class IN ('self_storage', 'rv_storage', 'boat_storage')),
  
  -- Collection metadata (keyed by execution_id)
  collected_at TIMESTAMPTZ DEFAULT now(),
  duration_ms INTEGER,
  source_count INTEGER DEFAULT 0,
  
  -- Status machine
  status TEXT CHECK (status IN ('pending', 'validated', 'rejected', 'promoted')) DEFAULT 'pending',
  
  -- Completeness flags (CORRECT LOGIC per spec)
  -- envelope_complete = all REQUIRED_FOR_ENVELOPE fields are 'known'
  -- card_complete = all fields are 'known' OR 'blocked' (researched, not unknown)
  envelope_complete BOOLEAN DEFAULT FALSE,
  card_complete BOOLEAN DEFAULT FALSE,
  fatal_prohibition TEXT CHECK (fatal_prohibition IN ('yes', 'no', 'unknown')) DEFAULT 'unknown',
  
  -- Full jurisdiction card payload (spec-compliant)
  card_payload JSONB NOT NULL DEFAULT '{}',
  
  -- Field-level knowledge states: { field_name: 'known' | 'unknown' | 'blocked' }
  field_states JSONB NOT NULL DEFAULT '{}',
  
  -- Provenance audit trail: [{ field, source_type, source_reference, authority_scope, verified_at, raw_text }]
  provenance_log JSONB NOT NULL DEFAULT '[]',
  
  -- Red flags and conflicts detected during collection
  red_flags JSONB DEFAULT '[]',
  
  -- Rejection/error info
  failure_reason TEXT,
  
  -- Promotion tracking (references execution_id for audit)
  promoted_at TIMESTAMPTZ,
  neon_version_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for jurisdiction_card_drafts
CREATE INDEX idx_jc_drafts_execution ON public.jurisdiction_card_drafts(execution_id);
CREATE INDEX idx_jc_drafts_county ON public.jurisdiction_card_drafts(county_id, asset_class);
CREATE INDEX idx_jc_drafts_status ON public.jurisdiction_card_drafts(status);
CREATE INDEX idx_jc_drafts_state ON public.jurisdiction_card_drafts(state_code);

-- 1.2 Create jurisdiction_collection_log table
CREATE TABLE public.jurisdiction_collection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,  -- PRIMARY TRACE KEY
  county_id INTEGER NOT NULL,
  state_code TEXT NOT NULL,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Field counts
  source_count INTEGER DEFAULT 0,
  known_count INTEGER DEFAULT 0,
  unknown_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  
  -- Red flags detected
  red_flags JSONB DEFAULT '[]',
  
  -- Execution status
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for jurisdiction_collection_log
CREATE INDEX idx_jc_log_execution ON public.jurisdiction_collection_log(execution_id);
CREATE INDEX idx_jc_log_county ON public.jurisdiction_collection_log(county_id);
CREATE INDEX idx_jc_log_status ON public.jurisdiction_collection_log(status);

-- Enable RLS
ALTER TABLE public.jurisdiction_card_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurisdiction_collection_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, tighten based on auth later)
CREATE POLICY "Allow all for jurisdiction_card_drafts" ON public.jurisdiction_card_drafts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for jurisdiction_collection_log" ON public.jurisdiction_collection_log
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at on drafts
CREATE TRIGGER update_jurisdiction_card_drafts_updated_at
  BEFORE UPDATE ON public.jurisdiction_card_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();