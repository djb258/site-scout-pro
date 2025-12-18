-- ============================================================================
-- COUNTY CAPABILITY PROFILES MIGRATION
-- Doctrine: County Capability Asset (CCA) — NOT Pass 2, NOT jurisdiction rules
-- ============================================================================
-- Purpose: Store county capability profiles for automation routing
-- Answers: HOW to get information from a county, not WHAT the rules are
-- Expiration: 12-month TTL with automatic revalidation
-- ============================================================================

-- Create schema for county capability data
CREATE SCHEMA IF NOT EXISTS ref_county_capability;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Zoning model classification
-- Describes HOW zoning is structured, not WHAT the zones allow
CREATE TYPE ref_county_capability.zoning_model AS ENUM (
    'countywide',       -- County has unified zoning ordinance
    'municipal_only',   -- Zoning delegated to municipalities
    'overlay_based',    -- Zoning via overlay districts
    'no_zoning',        -- County has no zoning (valid first-class model)
    'unknown'           -- Not yet determined
);

-- Permit system classification
-- Describes HOW permits are accessed, not permit requirements
CREATE TYPE ref_county_capability.permit_system AS ENUM (
    'api',              -- Programmatic API access available
    'portal_scrape',    -- Web portal that can be scraped
    'pdf_logs',         -- PDF-based permit logs
    'manual_only',      -- Phone/in-person only
    'unknown'           -- Not yet determined
);

-- Document quality classification
-- Describes HOW documents are formatted, not content
CREATE TYPE ref_county_capability.document_quality AS ENUM (
    'structured_html',  -- Modern HTML with semantic markup
    'searchable_pdf',   -- PDF with text layer
    'scanned_pdf',      -- Image-only PDF (OCR required)
    'none',             -- No online documents
    'unknown'           -- Not yet determined
);

-- Confidence level for capability assessment
CREATE TYPE ref_county_capability.confidence_level AS ENUM (
    'low',              -- Initial probe, limited signals
    'medium',           -- Multiple signals confirmed
    'high'              -- Verified by manual review
);

-- ============================================================================
-- MAIN TABLE: COUNTY CAPABILITY PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ref_county_capability.county_capability_profiles (
    -- Primary key (references ref.ref_county)
    county_id INTEGER PRIMARY KEY REFERENCES ref.ref_county(county_id) ON DELETE CASCADE,

    -- =========================================================================
    -- CAPABILITY CLASSIFICATIONS
    -- =========================================================================

    -- How zoning is structured in this county
    zoning_model ref_county_capability.zoning_model NOT NULL DEFAULT 'unknown',

    -- How permits can be accessed
    permit_system ref_county_capability.permit_system NOT NULL DEFAULT 'unknown',

    -- Whether inspection records are linked to permits
    inspections_linked BOOLEAN,

    -- Quality of online documents
    document_quality ref_county_capability.document_quality NOT NULL DEFAULT 'unknown',

    -- =========================================================================
    -- COMPUTED: AUTOMATION VIABILITY
    -- =========================================================================

    -- Can this county be automated? (computed from other fields)
    automation_viable BOOLEAN GENERATED ALWAYS AS (
        permit_system IN ('api', 'portal_scrape')
        AND document_quality IN ('structured_html', 'searchable_pdf')
    ) STORED,

    -- =========================================================================
    -- TTL & REVALIDATION
    -- =========================================================================

    -- When was this profile last verified?
    last_verified_at TIMESTAMPTZ,

    -- When does this profile expire? (auto-calculated on insert/update)
    expires_at TIMESTAMPTZ,

    -- =========================================================================
    -- METADATA
    -- =========================================================================

    -- Confidence in the capability assessment
    confidence_level ref_county_capability.confidence_level NOT NULL DEFAULT 'low',

    -- Free-form notes (e.g., "Accela portal, requires login")
    notes TEXT,

    -- Detected vendor (e.g., "Accela", "Tyler", "Municity")
    detected_vendor TEXT,

    -- URL of planning/permits page (for re-probing)
    planning_url TEXT,
    permits_url TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for finding expired profiles
CREATE INDEX IF NOT EXISTS idx_capability_expires_at
    ON ref_county_capability.county_capability_profiles(expires_at);

-- Index for finding profiles by automation viability
CREATE INDEX IF NOT EXISTS idx_capability_automation_viable
    ON ref_county_capability.county_capability_profiles(automation_viable);

-- Index for finding profiles by zoning model
CREATE INDEX IF NOT EXISTS idx_capability_zoning_model
    ON ref_county_capability.county_capability_profiles(zoning_model);

-- Index for finding profiles by permit system
CREATE INDEX IF NOT EXISTS idx_capability_permit_system
    ON ref_county_capability.county_capability_profiles(permit_system);

-- ============================================================================
-- TRIGGER: Auto-calculate expires_at
-- ============================================================================

CREATE OR REPLACE FUNCTION ref_county_capability.calculate_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set expires_at to 12 months after last_verified_at
    IF NEW.last_verified_at IS NOT NULL THEN
        NEW.expires_at := NEW.last_verified_at + INTERVAL '12 months';
    END IF;

    -- Update timestamp
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_expiration
    BEFORE INSERT OR UPDATE ON ref_county_capability.county_capability_profiles
    FOR EACH ROW
    EXECUTE FUNCTION ref_county_capability.calculate_expiration();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if a county profile is expired
CREATE OR REPLACE FUNCTION ref_county_capability.is_profile_expired(p_county_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT expires_at INTO v_expires_at
    FROM ref_county_capability.county_capability_profiles
    WHERE county_id = p_county_id;

    -- No profile = treat as expired (needs probe)
    IF v_expires_at IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if expired
    RETURN v_expires_at < NOW();
END;
$$;

-- Check if a county is automation-viable (with expiration check)
CREATE OR REPLACE FUNCTION ref_county_capability.is_automation_viable(p_county_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_viable BOOLEAN;
    v_expired BOOLEAN;
BEGIN
    -- Check expiration first
    v_expired := ref_county_capability.is_profile_expired(p_county_id);

    IF v_expired THEN
        -- Expired profiles are not viable (force re-probe)
        RETURN FALSE;
    END IF;

    -- Get viability
    SELECT automation_viable INTO v_viable
    FROM ref_county_capability.county_capability_profiles
    WHERE county_id = p_county_id;

    RETURN COALESCE(v_viable, FALSE);
END;
$$;

-- Get effective capability (returns 'unknown' if expired)
CREATE OR REPLACE FUNCTION ref_county_capability.get_effective_capability(p_county_id INTEGER)
RETURNS TABLE (
    zoning_model ref_county_capability.zoning_model,
    permit_system ref_county_capability.permit_system,
    document_quality ref_county_capability.document_quality,
    automation_viable BOOLEAN,
    is_expired BOOLEAN,
    confidence_level ref_county_capability.confidence_level
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired BOOLEAN;
BEGIN
    v_expired := ref_county_capability.is_profile_expired(p_county_id);

    IF v_expired THEN
        -- Return all unknowns for expired profiles
        RETURN QUERY SELECT
            'unknown'::ref_county_capability.zoning_model,
            'unknown'::ref_county_capability.permit_system,
            'unknown'::ref_county_capability.document_quality,
            FALSE,
            TRUE,
            'low'::ref_county_capability.confidence_level;
    ELSE
        -- Return actual values
        RETURN QUERY SELECT
            ccp.zoning_model,
            ccp.permit_system,
            ccp.document_quality,
            ccp.automation_viable,
            FALSE,
            ccp.confidence_level
        FROM ref_county_capability.county_capability_profiles ccp
        WHERE ccp.county_id = p_county_id;
    END IF;
END;
$$;

-- ============================================================================
-- VIEW: Capability Summary
-- ============================================================================

CREATE OR REPLACE VIEW ref_county_capability.capability_summary AS
SELECT
    ccp.county_id,
    rc.county_name,
    rs.state_code,
    ccp.zoning_model,
    ccp.permit_system,
    ccp.document_quality,
    ccp.automation_viable,
    ccp.inspections_linked,
    ccp.detected_vendor,
    ccp.confidence_level,
    ccp.last_verified_at,
    ccp.expires_at,
    (ccp.expires_at < NOW()) AS is_expired,
    ccp.notes
FROM ref_county_capability.county_capability_profiles ccp
JOIN ref.ref_county rc ON ccp.county_id = rc.county_id
JOIN ref.ref_state rs ON rc.state_id = rs.state_id;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ref_county_capability.county_capability_profiles ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "capability_profiles_read" ON ref_county_capability.county_capability_profiles
    FOR SELECT TO authenticated USING (true);

-- Read access for anon (reference data)
CREATE POLICY "capability_profiles_anon_read" ON ref_county_capability.county_capability_profiles
    FOR SELECT TO anon USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA ref_county_capability IS 'County Capability Asset (CCA) — HOW to get data, not WHAT the rules are';
COMMENT ON TABLE ref_county_capability.county_capability_profiles IS 'Capability profiles for automation routing (12-month TTL)';
COMMENT ON COLUMN ref_county_capability.county_capability_profiles.zoning_model IS 'How zoning is structured (countywide/municipal/overlay/no_zoning/unknown)';
COMMENT ON COLUMN ref_county_capability.county_capability_profiles.permit_system IS 'How permits are accessed (api/portal_scrape/pdf_logs/manual_only/unknown)';
COMMENT ON COLUMN ref_county_capability.county_capability_profiles.document_quality IS 'Quality of online documents (structured_html/searchable_pdf/scanned_pdf/none/unknown)';
COMMENT ON COLUMN ref_county_capability.county_capability_profiles.automation_viable IS 'Computed: Can this county be automated?';
COMMENT ON COLUMN ref_county_capability.county_capability_profiles.expires_at IS 'Profile expiration (12 months after last_verified_at)';
