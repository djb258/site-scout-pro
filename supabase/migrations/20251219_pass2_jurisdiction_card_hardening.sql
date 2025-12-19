-- ============================================================================
-- PASS 2 JURISDICTION CARD HARDENING MIGRATION
-- Doctrine: Pass 2 = Canonical Jurisdiction Card (WHAT jurisdictional facts exist)
-- ============================================================================
-- This migration enforces the separation:
--   CCA (ref schema) = HOW information may be acquired
--   Pass 2 (pass2 schema) = WHAT jurisdictional facts exist
--   Pass 3 = Consumes Pass 2 blindly, NEVER references CCA
-- ============================================================================
-- CRITICAL DOCTRINE:
-- - Missing data is explicitly represented as 'unknown', NEVER inferred
-- - This reflects how a paper zoning/jurisdiction card would be filled out
-- - Every numeric field has: value, unit, provenance (source, authority, verified_at)
-- - CCA never owns or defines jurisdiction values
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE IDENTITY ENUMS
-- ============================================================================

-- Authority model (who decides zoning)
CREATE TYPE pass2.authority_model AS ENUM (
    'county',       -- County has unified authority
    'municipal',    -- Municipalities have authority
    'mixed',        -- Split/overlapping authority
    'none'          -- No zoning authority (unzoned areas)
);

-- Zoning model (how zoning is structured)
CREATE TYPE pass2.zoning_model AS ENUM (
    'no_zoning',    -- No zoning exists (valid first-class)
    'county',       -- County-level zoning
    'municipal',    -- Municipal zoning
    'mixed'         -- Mixed zoning authority
);

-- Ternary value for yes/no/unknown fields
CREATE TYPE pass2.ternary AS ENUM (
    'yes',
    'no',
    'unknown'
);

-- ============================================================================
-- SECTION 2: JURISDICTION CARD IDENTITY TABLE
-- One row per (county × asset_class) — This IS the paper card
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_card_identity (
    -- Primary key
    card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core identity (DOCTRINE: Pass 2 owns ALL of these)
    county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id),
    state_code TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('self_storage', 'rv_storage', 'boat_storage')),

    -- Authority model (DOCTRINE: Pass 2 owns this, NOT CCA)
    authority_model pass2.authority_model NOT NULL DEFAULT 'county',
    zoning_model pass2.zoning_model NOT NULL DEFAULT 'county',

    -- Completeness tracking
    card_complete BOOLEAN NOT NULL DEFAULT FALSE,
    envelope_complete BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,

    -- Uniqueness
    CONSTRAINT uq_jurisdiction_card_identity UNIQUE (county_id, asset_class)
);

-- ============================================================================
-- SECTION 3: USE VIABILITY TABLE
-- Answers: Can storage be built here at all?
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_use_viability (
    -- Primary key
    viability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent card
    card_id UUID NOT NULL REFERENCES pass2.jurisdiction_card_identity(card_id) ON DELETE CASCADE,

    -- Use viability fields (DOCTRINE: Pass 2 owns ALL of these)
    storage_allowed_somewhere pass2.ternary NOT NULL DEFAULT 'unknown',
    fatal_prohibition pass2.ternary NOT NULL DEFAULT 'unknown',
    prohibition_notes TEXT,

    -- Zoning allowance specifics
    storage_by_right pass2.ternary NOT NULL DEFAULT 'unknown',
    conditional_use_required pass2.ternary NOT NULL DEFAULT 'unknown',
    special_exception_required pass2.ternary NOT NULL DEFAULT 'unknown',

    -- Provenance
    source TEXT,
    authority_scope pass2.authority_scope NOT NULL DEFAULT 'unknown',
    verified_at TIMESTAMPTZ,
    research_notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One viability record per card
    CONSTRAINT uq_jurisdiction_use_viability UNIQUE (card_id)
);

-- ============================================================================
-- SECTION 4: ENVELOPE/GEOMETRY CONSTRAINTS TABLE
-- NUMERIC fields with units and provenance (REQUIRED_FOR_ENVELOPE)
-- DOCTRINE: Every numeric value carries units and provenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_envelope_constraints (
    -- Primary key
    constraint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent card
    card_id UUID NOT NULL REFERENCES pass2.jurisdiction_card_identity(card_id) ON DELETE CASCADE,

    -- =========================================================================
    -- SETBACKS (Required for geometry calculation)
    -- =========================================================================
    front_setback_min_ft NUMERIC,
    front_setback_min_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    front_setback_min_source TEXT,
    front_setback_min_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    front_setback_min_verified_at TIMESTAMPTZ,

    side_setback_min_ft NUMERIC,
    side_setback_min_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    side_setback_min_source TEXT,
    side_setback_min_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    side_setback_min_verified_at TIMESTAMPTZ,

    rear_setback_min_ft NUMERIC,
    rear_setback_min_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    rear_setback_min_source TEXT,
    rear_setback_min_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    rear_setback_min_verified_at TIMESTAMPTZ,

    -- =========================================================================
    -- COVERAGE (Required for geometry calculation)
    -- =========================================================================
    max_lot_coverage_pct NUMERIC CHECK (max_lot_coverage_pct IS NULL OR (max_lot_coverage_pct >= 0 AND max_lot_coverage_pct <= 100)),
    max_lot_coverage_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    max_lot_coverage_source TEXT,
    max_lot_coverage_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    max_lot_coverage_verified_at TIMESTAMPTZ,

    min_open_space_pct NUMERIC CHECK (min_open_space_pct IS NULL OR (min_open_space_pct >= 0 AND min_open_space_pct <= 100)),
    min_open_space_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    min_open_space_source TEXT,
    min_open_space_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    min_open_space_verified_at TIMESTAMPTZ,

    max_impervious_pct NUMERIC CHECK (max_impervious_pct IS NULL OR (max_impervious_pct >= 0 AND max_impervious_pct <= 100)),
    max_impervious_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    max_impervious_source TEXT,
    max_impervious_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    max_impervious_verified_at TIMESTAMPTZ,

    -- =========================================================================
    -- BUFFERS (Required for geometry calculation)
    -- =========================================================================
    buffer_width_min_ft NUMERIC,
    buffer_width_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    buffer_width_source TEXT,
    buffer_width_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    buffer_width_verified_at TIMESTAMPTZ,

    landscape_buffer_min_ft NUMERIC,
    landscape_buffer_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    landscape_buffer_source TEXT,
    landscape_buffer_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    landscape_buffer_verified_at TIMESTAMPTZ,

    -- =========================================================================
    -- FIRE ACCESS (Required for geometry calculation)
    -- =========================================================================
    fire_lane_width_min_ft NUMERIC,
    fire_lane_width_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    fire_lane_width_source TEXT,
    fire_lane_width_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    fire_lane_width_verified_at TIMESTAMPTZ,

    fire_hydrant_spacing_max_ft NUMERIC,
    fire_hydrant_spacing_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    fire_hydrant_spacing_source TEXT,
    fire_hydrant_spacing_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    fire_hydrant_spacing_verified_at TIMESTAMPTZ,

    sprinkler_required pass2.ternary NOT NULL DEFAULT 'unknown',
    sprinkler_required_source TEXT,
    sprinkler_required_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    sprinkler_required_verified_at TIMESTAMPTZ,

    -- =========================================================================
    -- STORMWATER (Required for geometry calculation)
    -- =========================================================================
    stormwater_detention_required pass2.ternary NOT NULL DEFAULT 'unknown',
    stormwater_detention_source TEXT,
    stormwater_detention_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    stormwater_detention_verified_at TIMESTAMPTZ,

    impervious_surface_max_pct NUMERIC CHECK (impervious_surface_max_pct IS NULL OR (impervious_surface_max_pct >= 0 AND impervious_surface_max_pct <= 100)),
    impervious_surface_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    impervious_surface_source TEXT,
    impervious_surface_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    impervious_surface_verified_at TIMESTAMPTZ,

    stormwater_reservation_factor NUMERIC CHECK (stormwater_reservation_factor IS NULL OR stormwater_reservation_factor >= 0),
    stormwater_reservation_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    stormwater_reservation_source TEXT,
    stormwater_reservation_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    stormwater_reservation_verified_at TIMESTAMPTZ,

    -- =========================================================================
    -- HEIGHT & FAR (Required for geometry calculation)
    -- =========================================================================
    max_height_ft NUMERIC,
    max_height_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    max_height_source TEXT,
    max_height_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    max_height_verified_at TIMESTAMPTZ,

    max_stories INTEGER,
    max_stories_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    max_stories_source TEXT,
    max_stories_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    max_stories_verified_at TIMESTAMPTZ,

    floor_area_ratio NUMERIC CHECK (floor_area_ratio IS NULL OR floor_area_ratio >= 0),
    floor_area_ratio_knowledge pass2.knowledge_state NOT NULL DEFAULT 'unknown',
    floor_area_ratio_source TEXT,
    floor_area_ratio_authority pass2.authority_scope NOT NULL DEFAULT 'unknown',
    floor_area_ratio_verified_at TIMESTAMPTZ,

    -- =========================================================================
    -- METADATA
    -- =========================================================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One envelope record per card
    CONSTRAINT uq_jurisdiction_envelope UNIQUE (card_id)
);

-- ============================================================================
-- SECTION 5: REQUIRED_FOR_ENVELOPE FIELD REGISTRY
-- Defines which fields MUST be known for geometry calculation
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.required_for_envelope_fields (
    field_name TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    unit TEXT,
    failure_behavior TEXT NOT NULL DEFAULT 'HARD_FAIL' CHECK (failure_behavior IN ('HARD_FAIL', 'WARN'))
);

INSERT INTO pass2.required_for_envelope_fields (field_name, description, unit, failure_behavior) VALUES
    ('front_setback_min_ft', 'Front setback minimum', 'feet', 'HARD_FAIL'),
    ('side_setback_min_ft', 'Side setback minimum', 'feet', 'HARD_FAIL'),
    ('rear_setback_min_ft', 'Rear setback minimum', 'feet', 'HARD_FAIL'),
    ('max_lot_coverage_pct', 'Maximum lot coverage', 'percent', 'HARD_FAIL'),
    ('fire_lane_width_min_ft', 'Fire lane width minimum', 'feet', 'HARD_FAIL'),
    ('buffer_width_min_ft', 'Buffer width minimum', 'feet', 'WARN'),
    ('max_impervious_pct', 'Maximum impervious surface', 'percent', 'WARN'),
    ('stormwater_detention_required', 'Stormwater detention required', NULL, 'WARN')
ON CONFLICT (field_name) DO NOTHING;

-- ============================================================================
-- SECTION 6: ENVELOPE COMPLETENESS CHECK FUNCTION
-- DOCTRINE: Any REQUIRED_FOR_ENVELOPE + unknown = HARD FAIL
-- ============================================================================

CREATE OR REPLACE FUNCTION pass2.check_envelope_completeness(p_card_id UUID)
RETURNS TABLE (
    complete BOOLEAN,
    missing_fields TEXT[],
    unknown_fields TEXT[],
    blocked_fields TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_envelope pass2.jurisdiction_envelope_constraints%ROWTYPE;
    v_missing TEXT[] := '{}';
    v_unknown TEXT[] := '{}';
    v_blocked TEXT[] := '{}';
BEGIN
    -- Get envelope
    SELECT * INTO v_envelope
    FROM pass2.jurisdiction_envelope_constraints
    WHERE card_id = p_card_id;

    IF NOT FOUND THEN
        -- No envelope record = all fields missing
        RETURN QUERY SELECT
            FALSE,
            ARRAY['front_setback_min_ft', 'side_setback_min_ft', 'rear_setback_min_ft', 'max_lot_coverage_pct', 'fire_lane_width_min_ft'],
            '{}'::TEXT[],
            '{}'::TEXT[];
        RETURN;
    END IF;

    -- Check each REQUIRED_FOR_ENVELOPE field
    -- Front setback
    IF v_envelope.front_setback_min_knowledge = 'unknown' THEN
        v_unknown := array_append(v_unknown, 'front_setback_min_ft');
    ELSIF v_envelope.front_setback_min_knowledge = 'blocked' THEN
        v_blocked := array_append(v_blocked, 'front_setback_min_ft');
    ELSIF v_envelope.front_setback_min_ft IS NULL THEN
        v_missing := array_append(v_missing, 'front_setback_min_ft');
    END IF;

    -- Side setback
    IF v_envelope.side_setback_min_knowledge = 'unknown' THEN
        v_unknown := array_append(v_unknown, 'side_setback_min_ft');
    ELSIF v_envelope.side_setback_min_knowledge = 'blocked' THEN
        v_blocked := array_append(v_blocked, 'side_setback_min_ft');
    ELSIF v_envelope.side_setback_min_ft IS NULL THEN
        v_missing := array_append(v_missing, 'side_setback_min_ft');
    END IF;

    -- Rear setback
    IF v_envelope.rear_setback_min_knowledge = 'unknown' THEN
        v_unknown := array_append(v_unknown, 'rear_setback_min_ft');
    ELSIF v_envelope.rear_setback_min_knowledge = 'blocked' THEN
        v_blocked := array_append(v_blocked, 'rear_setback_min_ft');
    ELSIF v_envelope.rear_setback_min_ft IS NULL THEN
        v_missing := array_append(v_missing, 'rear_setback_min_ft');
    END IF;

    -- Max lot coverage
    IF v_envelope.max_lot_coverage_knowledge = 'unknown' THEN
        v_unknown := array_append(v_unknown, 'max_lot_coverage_pct');
    ELSIF v_envelope.max_lot_coverage_knowledge = 'blocked' THEN
        v_blocked := array_append(v_blocked, 'max_lot_coverage_pct');
    ELSIF v_envelope.max_lot_coverage_pct IS NULL THEN
        v_missing := array_append(v_missing, 'max_lot_coverage_pct');
    END IF;

    -- Fire lane width
    IF v_envelope.fire_lane_width_knowledge = 'unknown' THEN
        v_unknown := array_append(v_unknown, 'fire_lane_width_min_ft');
    ELSIF v_envelope.fire_lane_width_knowledge = 'blocked' THEN
        v_blocked := array_append(v_blocked, 'fire_lane_width_min_ft');
    ELSIF v_envelope.fire_lane_width_min_ft IS NULL THEN
        v_missing := array_append(v_missing, 'fire_lane_width_min_ft');
    END IF;

    -- Return result
    RETURN QUERY SELECT
        (array_length(v_missing, 1) IS NULL OR array_length(v_missing, 1) = 0)
        AND (array_length(v_unknown, 1) IS NULL OR array_length(v_unknown, 1) = 0)
        AND (array_length(v_blocked, 1) IS NULL OR array_length(v_blocked, 1) = 0),
        v_missing,
        v_unknown,
        v_blocked;
END;
$$;

-- ============================================================================
-- SECTION 7: PASS 3 CONSUMPTION VIEW
-- DOCTRINE: Pass 3 reads ONLY this view, NEVER references CCA
-- ============================================================================

CREATE OR REPLACE VIEW pass2.v_jurisdiction_card_for_pass3 AS
SELECT
    -- Identity
    jci.card_id,
    jci.county_id,
    jci.state_code,
    jci.asset_class,
    jci.authority_model,
    jci.zoning_model,

    -- Completeness
    jci.card_complete,
    jci.envelope_complete,

    -- Use viability
    juv.storage_allowed_somewhere,
    juv.fatal_prohibition,
    juv.prohibition_notes,
    juv.storage_by_right,
    juv.conditional_use_required,

    -- Envelope constraints (values only — Pass 3 trusts blindly)
    jec.front_setback_min_ft,
    jec.side_setback_min_ft,
    jec.rear_setback_min_ft,
    jec.max_lot_coverage_pct,
    jec.min_open_space_pct,
    jec.buffer_width_min_ft,
    jec.fire_lane_width_min_ft,
    jec.fire_hydrant_spacing_max_ft,
    jec.sprinkler_required,
    jec.stormwater_detention_required,
    jec.impervious_surface_max_pct,
    jec.max_height_ft,
    jec.max_stories,
    jec.floor_area_ratio,

    -- Metadata
    jci.updated_at

FROM pass2.jurisdiction_card_identity jci
LEFT JOIN pass2.jurisdiction_use_viability juv ON jci.card_id = juv.card_id
LEFT JOIN pass2.jurisdiction_envelope_constraints jec ON jci.card_id = jec.card_id;

COMMENT ON VIEW pass2.v_jurisdiction_card_for_pass3 IS 'Pass 3 consumption view — NEVER reference CCA from Pass 3';

-- ============================================================================
-- SECTION 8: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jci_county ON pass2.jurisdiction_card_identity(county_id);
CREATE INDEX IF NOT EXISTS idx_jci_asset_class ON pass2.jurisdiction_card_identity(asset_class);
CREATE INDEX IF NOT EXISTS idx_jci_complete ON pass2.jurisdiction_card_identity(card_complete);
CREATE INDEX IF NOT EXISTS idx_juv_card ON pass2.jurisdiction_use_viability(card_id);
CREATE INDEX IF NOT EXISTS idx_jec_card ON pass2.jurisdiction_envelope_constraints(card_id);

-- ============================================================================
-- SECTION 9: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE pass2.jurisdiction_card_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.jurisdiction_use_viability ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.jurisdiction_envelope_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.required_for_envelope_fields ENABLE ROW LEVEL SECURITY;

-- Read access
CREATE POLICY "jci_read" ON pass2.jurisdiction_card_identity FOR SELECT TO authenticated USING (true);
CREATE POLICY "juv_read" ON pass2.jurisdiction_use_viability FOR SELECT TO authenticated USING (true);
CREATE POLICY "jec_read" ON pass2.jurisdiction_envelope_constraints FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_fields_read" ON pass2.required_for_envelope_fields FOR SELECT TO authenticated, anon USING (true);

-- ============================================================================
-- SECTION 10: COMMENTS
-- ============================================================================

COMMENT ON TABLE pass2.jurisdiction_card_identity IS 'Pass 2 Jurisdiction Card — Core identity (WHAT jurisdictional facts exist)';
COMMENT ON TABLE pass2.jurisdiction_use_viability IS 'Pass 2 — Use viability facts (can storage be built here?)';
COMMENT ON TABLE pass2.jurisdiction_envelope_constraints IS 'Pass 2 — Envelope/geometry constraints with provenance';
COMMENT ON TABLE pass2.required_for_envelope_fields IS 'Registry of REQUIRED_FOR_ENVELOPE fields that must be known';

-- ============================================================================
-- DOCTRINE ENFORCEMENT COMMENTS
-- ============================================================================

COMMENT ON SCHEMA pass2 IS '
PASS 2 = CANONICAL JURISDICTION CARD (WHAT)

DOCTRINE:
- Pass 2 owns ALL jurisdictional facts and numeric constraints
- CCA (ref schema) owns ONLY acquisition feasibility (HOW)
- Pass 3 consumes Pass 2 blindly, NEVER references CCA
- Missing data is explicitly "unknown", NEVER inferred
- Every numeric field has: value, unit, provenance

SEPARATION:
- CCA answers: Can we scrape this county? What vendor? Is it manual-only?
- Pass 2 answers: What are the setbacks? Is storage allowed? What permits needed?

HARD RULE:
- Any calculation encountering REQUIRED_FOR_ENVELOPE + unknown = HARD FAIL
- No defaults. No inference. No guessing.
';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
