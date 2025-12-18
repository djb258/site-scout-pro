-- ============================================================================
-- PASS 2 JURISDICTION CARDS MIGRATION
-- Doctrine: Pass 2 = Jurisdiction Card Completion Engine (ADR-019)
-- ============================================================================
-- Purpose: Persist jurisdiction constraints for (county × asset_class) combos
-- Schema must support partial cards and incremental hydration
-- Unknown data must be representable without lying
-- ============================================================================

-- Create pass2 schema for jurisdiction cards
CREATE SCHEMA IF NOT EXISTS pass2;

-- ============================================================================
-- REFERENCE TYPES (ENUMS)
-- ============================================================================

-- Criticality levels for constraint fields
CREATE TYPE pass2.constraint_criticality AS ENUM (
    'REQUIRED_FOR_ENVELOPE',   -- Must be known for buildability calculation
    'REQUIRED_FOR_APPROVAL',   -- Must be known before permitting
    'INFORMATIONAL'            -- Nice to have, does not block anything
);

-- Field knowledge states
CREATE TYPE pass2.knowledge_state AS ENUM (
    'known',    -- Value confirmed and trustworthy
    'unknown',  -- Value has not been researched
    'blocked'   -- Research attempted, value could not be determined
);

-- Authority scope types
CREATE TYPE pass2.authority_scope AS ENUM (
    'county',
    'municipality',
    'watershed',
    'state',
    'fire_district',
    'dot',
    'utility',
    'unknown'
);

-- ============================================================================
-- 1. JURISDICTION CARDS (Root Table)
-- One row per (county × asset_class)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_cards (
    -- Primary key
    jurisdiction_card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys to ref schema
    county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id) ON DELETE RESTRICT,
    asset_class_id INTEGER NOT NULL REFERENCES ref.ref_asset_class(asset_class_id) ON DELETE RESTRICT,

    -- Card completeness (PRIMARY signal for Pass 3)
    jurisdiction_card_complete BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,

    -- Version for optimistic locking
    version INTEGER NOT NULL DEFAULT 1,

    -- Uniqueness: one card per county × asset_class
    CONSTRAINT uq_jurisdiction_card_county_asset UNIQUE (county_id, asset_class_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jurisdiction_cards_county ON pass2.jurisdiction_cards(county_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_cards_asset_class ON pass2.jurisdiction_cards(asset_class_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_cards_complete ON pass2.jurisdiction_cards(jurisdiction_card_complete);

-- ============================================================================
-- 2. JURISDICTION CONSTRAINTS (Field-Level Constants)
-- One row per constraint field per card
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_constraints (
    -- Primary key
    constraint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent card
    jurisdiction_card_id UUID NOT NULL REFERENCES pass2.jurisdiction_cards(jurisdiction_card_id) ON DELETE CASCADE,

    -- Constraint identity
    constraint_key TEXT NOT NULL,           -- Canonical name (e.g., 'front_setback_ft')
    constraint_value JSONB,                 -- Value (null if unknown/blocked)

    -- Criticality and knowledge state
    criticality pass2.constraint_criticality NOT NULL,
    knowledge_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',

    -- Authority and provenance
    authority_scope pass2.authority_scope NOT NULL DEFAULT 'unknown',
    verified_at TIMESTAMPTZ,
    revalidation_required BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT,
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Uniqueness: one row per constraint_key per card
    CONSTRAINT uq_jurisdiction_constraint_key UNIQUE (jurisdiction_card_id, constraint_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jurisdiction_constraints_card ON pass2.jurisdiction_constraints(jurisdiction_card_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_constraints_key ON pass2.jurisdiction_constraints(constraint_key);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_constraints_criticality ON pass2.jurisdiction_constraints(criticality, knowledge_state);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_constraints_revalidation ON pass2.jurisdiction_constraints(revalidation_required) WHERE revalidation_required = TRUE;

-- ============================================================================
-- 3. JURISDICTION PROHIBITIONS (Fatal Blockers)
-- Explicit fatal blockers that make site un-developable
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_prohibitions (
    -- Primary key
    prohibition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent card
    jurisdiction_card_id UUID NOT NULL REFERENCES pass2.jurisdiction_cards(jurisdiction_card_id) ON DELETE CASCADE,

    -- Prohibition details
    prohibition_code TEXT NOT NULL,         -- e.g., 'STORAGE_PROHIBITED'
    description TEXT NOT NULL,

    -- Authority and provenance
    authority_scope pass2.authority_scope NOT NULL DEFAULT 'county',
    verified_at TIMESTAMPTZ,
    source TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Uniqueness: one prohibition code per card
    CONSTRAINT uq_jurisdiction_prohibition_code UNIQUE (jurisdiction_card_id, prohibition_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jurisdiction_prohibitions_card ON pass2.jurisdiction_prohibitions(jurisdiction_card_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_prohibitions_code ON pass2.jurisdiction_prohibitions(prohibition_code);

-- ============================================================================
-- 4. JURISDICTION PERMIT REQUIREMENTS (Checklist, Not Timelines)
-- What permits are needed (existence, not duration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.jurisdiction_permit_requirements (
    -- Primary key
    permit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent card
    jurisdiction_card_id UUID NOT NULL REFERENCES pass2.jurisdiction_cards(jurisdiction_card_id) ON DELETE CASCADE,

    -- Permit details
    permit_name TEXT NOT NULL,
    issuing_authority TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT TRUE,

    -- Authority and provenance
    authority_scope pass2.authority_scope NOT NULL DEFAULT 'county',
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Uniqueness: one permit name per card
    CONSTRAINT uq_jurisdiction_permit_name UNIQUE (jurisdiction_card_id, permit_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jurisdiction_permits_card ON pass2.jurisdiction_permit_requirements(jurisdiction_card_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_permits_required ON pass2.jurisdiction_permit_requirements(required);

-- ============================================================================
-- CANONICAL CONSTRAINT KEYS (Documentation)
-- ============================================================================
-- These are the canonical constraint_key values for jurisdiction_constraints.
-- Do NOT add keys without explicit doctrine change.
--
-- GEOMETRY / ENVELOPE (REQUIRED_FOR_ENVELOPE):
--   front_setback_ft
--   side_setback_ft
--   rear_setback_ft
--   max_lot_coverage_pct
--   max_impervious_pct
--   buffer_width_ft
--   slope_exclusion_pct
--   floodplain_exclusion
--   fire_lane_width_ft
--   ada_parking_ratio
--   stormwater_reservation_factor
--   max_height_ft
--   max_stories
--   floor_area_ratio
--
-- APPROVAL / EXECUTION (REQUIRED_FOR_APPROVAL):
--   storage_by_right
--   conditional_use_required
--   bonding_required
--   special_studies_required
--   approvals_required
--
-- INFORMATIONAL:
--   permit_path_type
--   storage_code_reference
--   inspection_regime_notes
--   landscape_pct_required
--   hydrant_spacing_ft
--   sprinkler_required
--   detention_required
--   retention_required
--   infiltration_allowed
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a card is complete (all REQUIRED_FOR_ENVELOPE fields known)
CREATE OR REPLACE FUNCTION pass2.check_card_completeness(p_card_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_missing_count INTEGER;
BEGIN
    -- Check if any REQUIRED_FOR_ENVELOPE constraints are not 'known'
    SELECT COUNT(*)
    INTO v_missing_count
    FROM pass2.jurisdiction_constraints
    WHERE jurisdiction_card_id = p_card_id
      AND criticality = 'REQUIRED_FOR_ENVELOPE'
      AND (knowledge_state != 'known' OR revalidation_required = TRUE);

    -- Check if any prohibitions exist
    IF EXISTS (
        SELECT 1 FROM pass2.jurisdiction_prohibitions
        WHERE jurisdiction_card_id = p_card_id
    ) THEN
        -- Card has prohibitions, cannot be "complete" for ELIGIBLE
        RETURN FALSE;
    END IF;

    RETURN v_missing_count = 0;
END;
$$;

-- Function to update card completeness after constraint changes
CREATE OR REPLACE FUNCTION pass2.update_card_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the parent card's completeness flag
    UPDATE pass2.jurisdiction_cards
    SET
        jurisdiction_card_complete = pass2.check_card_completeness(
            COALESCE(NEW.jurisdiction_card_id, OLD.jurisdiction_card_id)
        ),
        updated_at = NOW()
    WHERE jurisdiction_card_id = COALESCE(NEW.jurisdiction_card_id, OLD.jurisdiction_card_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers to auto-update card completeness
CREATE TRIGGER trg_update_card_completeness_on_constraint
    AFTER INSERT OR UPDATE OR DELETE ON pass2.jurisdiction_constraints
    FOR EACH ROW
    EXECUTE FUNCTION pass2.update_card_completeness();

CREATE TRIGGER trg_update_card_completeness_on_prohibition
    AFTER INSERT OR UPDATE OR DELETE ON pass2.jurisdiction_prohibitions
    FOR EACH ROW
    EXECUTE FUNCTION pass2.update_card_completeness();

-- ============================================================================
-- VIEW: Card Summary with Completeness
-- ============================================================================

CREATE OR REPLACE VIEW pass2.jurisdiction_card_summary AS
SELECT
    jc.jurisdiction_card_id,
    jc.county_id,
    rc.county_name,
    rs.state_code,
    jc.asset_class_id,
    ra.asset_class_code,
    jc.jurisdiction_card_complete,
    jc.created_at,
    jc.updated_at,

    -- Count of constraints by state
    COUNT(jcons.constraint_id) FILTER (WHERE jcons.knowledge_state = 'known') AS known_count,
    COUNT(jcons.constraint_id) FILTER (WHERE jcons.knowledge_state = 'unknown') AS unknown_count,
    COUNT(jcons.constraint_id) FILTER (WHERE jcons.knowledge_state = 'blocked') AS blocked_count,
    COUNT(jcons.constraint_id) FILTER (WHERE jcons.revalidation_required = TRUE) AS stale_count,

    -- Count of required fields
    COUNT(jcons.constraint_id) FILTER (
        WHERE jcons.criticality = 'REQUIRED_FOR_ENVELOPE' AND jcons.knowledge_state = 'known' AND jcons.revalidation_required = FALSE
    ) AS envelope_known_count,
    COUNT(jcons.constraint_id) FILTER (
        WHERE jcons.criticality = 'REQUIRED_FOR_ENVELOPE'
    ) AS envelope_total_count,

    -- Prohibitions
    COUNT(jp.prohibition_id) AS prohibition_count

FROM pass2.jurisdiction_cards jc
JOIN ref.ref_county rc ON jc.county_id = rc.county_id
JOIN ref.ref_state rs ON rc.state_id = rs.state_id
JOIN ref.ref_asset_class ra ON jc.asset_class_id = ra.asset_class_id
LEFT JOIN pass2.jurisdiction_constraints jcons ON jc.jurisdiction_card_id = jcons.jurisdiction_card_id
LEFT JOIN pass2.jurisdiction_prohibitions jp ON jc.jurisdiction_card_id = jp.jurisdiction_card_id
GROUP BY
    jc.jurisdiction_card_id,
    jc.county_id,
    rc.county_name,
    rs.state_code,
    jc.asset_class_id,
    ra.asset_class_code,
    jc.jurisdiction_card_complete,
    jc.created_at,
    jc.updated_at;

-- ============================================================================
-- SEED: Canonical Constraint Keys
-- Creates a reference table of allowed constraint keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS pass2.ref_constraint_keys (
    constraint_key TEXT PRIMARY KEY,
    criticality pass2.constraint_criticality NOT NULL,
    description TEXT,
    unit TEXT,
    value_type TEXT NOT NULL DEFAULT 'number'  -- 'number', 'boolean', 'text'
);

-- Seed canonical constraint keys
INSERT INTO pass2.ref_constraint_keys (constraint_key, criticality, description, unit, value_type) VALUES
    -- REQUIRED_FOR_ENVELOPE (Geometry)
    ('front_setback_ft', 'REQUIRED_FOR_ENVELOPE', 'Front setback distance', 'feet', 'number'),
    ('side_setback_ft', 'REQUIRED_FOR_ENVELOPE', 'Side setback distance', 'feet', 'number'),
    ('rear_setback_ft', 'REQUIRED_FOR_ENVELOPE', 'Rear setback distance', 'feet', 'number'),
    ('max_lot_coverage_pct', 'REQUIRED_FOR_ENVELOPE', 'Maximum lot coverage percentage', 'percent', 'number'),
    ('max_impervious_pct', 'REQUIRED_FOR_ENVELOPE', 'Maximum impervious surface percentage', 'percent', 'number'),
    ('buffer_width_ft', 'REQUIRED_FOR_ENVELOPE', 'Required buffer width', 'feet', 'number'),
    ('slope_exclusion_pct', 'REQUIRED_FOR_ENVELOPE', 'Slope exclusion threshold', 'percent', 'number'),
    ('floodplain_exclusion', 'REQUIRED_FOR_ENVELOPE', 'Floodplain exclusion required', NULL, 'boolean'),
    ('fire_lane_width_ft', 'REQUIRED_FOR_ENVELOPE', 'Required fire lane width', 'feet', 'number'),
    ('ada_parking_ratio', 'REQUIRED_FOR_ENVELOPE', 'ADA parking ratio requirement', NULL, 'text'),
    ('stormwater_reservation_factor', 'REQUIRED_FOR_ENVELOPE', 'Stormwater area reservation factor', 'decimal', 'number'),
    ('max_height_ft', 'REQUIRED_FOR_ENVELOPE', 'Maximum building height', 'feet', 'number'),
    ('max_stories', 'REQUIRED_FOR_ENVELOPE', 'Maximum number of stories', NULL, 'number'),
    ('floor_area_ratio', 'REQUIRED_FOR_ENVELOPE', 'Floor area ratio limit', NULL, 'number'),

    -- REQUIRED_FOR_APPROVAL
    ('storage_by_right', 'REQUIRED_FOR_APPROVAL', 'Storage use allowed by right', NULL, 'boolean'),
    ('conditional_use_required', 'REQUIRED_FOR_APPROVAL', 'Conditional use permit required', NULL, 'boolean'),
    ('bonding_required', 'REQUIRED_FOR_APPROVAL', 'Performance bond required', NULL, 'boolean'),
    ('special_studies_required', 'REQUIRED_FOR_APPROVAL', 'Special studies required', NULL, 'text'),
    ('approvals_required', 'REQUIRED_FOR_APPROVAL', 'List of required approvals', NULL, 'text'),

    -- INFORMATIONAL
    ('permit_path_type', 'INFORMATIONAL', 'Permit approval path type', NULL, 'text'),
    ('storage_code_reference', 'INFORMATIONAL', 'Storage-specific code reference', NULL, 'text'),
    ('inspection_regime_notes', 'INFORMATIONAL', 'Inspection requirements notes', NULL, 'text'),
    ('landscape_pct_required', 'INFORMATIONAL', 'Landscaping percentage required', 'percent', 'number'),
    ('hydrant_spacing_ft', 'INFORMATIONAL', 'Fire hydrant spacing requirement', 'feet', 'number'),
    ('sprinkler_required', 'INFORMATIONAL', 'Fire sprinkler system required', NULL, 'boolean'),
    ('detention_required', 'INFORMATIONAL', 'Stormwater detention required', NULL, 'boolean'),
    ('retention_required', 'INFORMATIONAL', 'Stormwater retention required', NULL, 'boolean'),
    ('infiltration_allowed', 'INFORMATIONAL', 'Stormwater infiltration allowed', NULL, 'boolean')
ON CONFLICT (constraint_key) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE pass2.jurisdiction_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.jurisdiction_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.jurisdiction_prohibitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.jurisdiction_permit_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass2.ref_constraint_keys ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "jurisdiction_cards_read" ON pass2.jurisdiction_cards
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "jurisdiction_constraints_read" ON pass2.jurisdiction_constraints
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "jurisdiction_prohibitions_read" ON pass2.jurisdiction_prohibitions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "jurisdiction_permits_read" ON pass2.jurisdiction_permit_requirements
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_constraint_keys_read" ON pass2.ref_constraint_keys
    FOR SELECT TO authenticated, anon USING (true);

-- Write access for service role only (via bypass)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA pass2 IS 'Pass 2 Jurisdiction Card Completion Engine (ADR-019)';
COMMENT ON TABLE pass2.jurisdiction_cards IS 'Root table: one card per (county × asset_class)';
COMMENT ON TABLE pass2.jurisdiction_constraints IS 'Field-level constants with knowledge state';
COMMENT ON TABLE pass2.jurisdiction_prohibitions IS 'Fatal blockers (e.g., storage prohibited)';
COMMENT ON TABLE pass2.jurisdiction_permit_requirements IS 'Permit checklist (existence, not duration)';
COMMENT ON TABLE pass2.ref_constraint_keys IS 'Canonical constraint keys - do not add without doctrine change';
