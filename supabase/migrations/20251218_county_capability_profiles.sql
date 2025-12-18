-- ============================================================================
-- COUNTY CAPABILITY ASSET (CCA) MIGRATION
-- Doctrine: Cross-Pass Reference Primitive — ABOVE Pass 0, not inside any pass
-- ============================================================================
-- Purpose: Store county capability profiles for automation routing
-- Answers: HOW to get information from a county, not WHAT the rules are
-- Expiration: 12-month TTL with automatic revalidation
-- ============================================================================
-- SCHEMA PLACEMENT: ref (shared reference data)
--
-- ref
-- ├── ref_country
-- ├── ref_state
-- ├── ref_county
-- ├── ref_zip
-- └── ref_county_capability   ← CCA lives here (THIS TABLE)
--
-- WHY ref schema:
-- - Shared across ALL passes (Pass 0, Pass 2, future passes)
-- - Slow-changing institutional memory
-- - Auditable and versionable
-- - Avoids Pass 0 writing into Pass 2 land (doctrinally wrong)
-- ============================================================================

-- ============================================================================
-- ENUM TYPES (in ref schema)
-- ============================================================================

-- Zoning model classification
-- Describes HOW zoning is structured, not WHAT the zones allow
CREATE TYPE ref.cca_zoning_model AS ENUM (
    'countywide',       -- County has unified zoning ordinance
    'municipal_only',   -- Zoning delegated to municipalities
    'overlay_based',    -- Zoning via overlay districts
    'no_zoning',        -- County has no zoning (valid first-class model)
    'unknown'           -- Not yet determined
);

-- Permit system classification
-- Describes HOW permits are accessed, not permit requirements
CREATE TYPE ref.cca_permit_system AS ENUM (
    'api',              -- Programmatic API access available
    'portal_scrape',    -- Web portal that can be scraped
    'pdf_logs',         -- PDF-based permit logs
    'manual_only',      -- Phone/in-person only
    'unknown'           -- Not yet determined
);

-- Document quality classification
-- Describes HOW documents are formatted, not content
CREATE TYPE ref.cca_document_quality AS ENUM (
    'structured_html',  -- Modern HTML with semantic markup
    'searchable_pdf',   -- PDF with text layer
    'scanned_pdf',      -- Image-only PDF (OCR required)
    'none',             -- No online documents
    'unknown'           -- Not yet determined
);

-- Confidence level for capability assessment
CREATE TYPE ref.cca_confidence_level AS ENUM (
    'low',              -- Initial probe, limited signals
    'medium',           -- Multiple signals confirmed
    'high'              -- Verified by manual review
);

-- ============================================================================
-- MAIN TABLE: COUNTY CAPABILITY PROFILES
-- Lives in ref schema alongside ref_county
-- ============================================================================

CREATE TABLE IF NOT EXISTS ref.ref_county_capability (
    -- Primary key (references ref.ref_county)
    county_id INTEGER PRIMARY KEY REFERENCES ref.ref_county(county_id) ON DELETE CASCADE,

    -- =========================================================================
    -- CAPABILITY CLASSIFICATIONS
    -- =========================================================================

    -- How zoning is structured in this county
    zoning_model ref.cca_zoning_model NOT NULL DEFAULT 'unknown',

    -- How permits can be accessed
    permit_system ref.cca_permit_system NOT NULL DEFAULT 'unknown',

    -- Whether inspection records are linked to permits
    inspections_linked BOOLEAN,

    -- Quality of online documents
    document_quality ref.cca_document_quality NOT NULL DEFAULT 'unknown',

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
    confidence_level ref.cca_confidence_level NOT NULL DEFAULT 'low',

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
CREATE INDEX IF NOT EXISTS idx_ref_county_capability_expires_at
    ON ref.ref_county_capability(expires_at);

-- Index for finding profiles by automation viability
CREATE INDEX IF NOT EXISTS idx_ref_county_capability_automation_viable
    ON ref.ref_county_capability(automation_viable);

-- Index for finding profiles by zoning model
CREATE INDEX IF NOT EXISTS idx_ref_county_capability_zoning_model
    ON ref.ref_county_capability(zoning_model);

-- Index for finding profiles by permit system
CREATE INDEX IF NOT EXISTS idx_ref_county_capability_permit_system
    ON ref.ref_county_capability(permit_system);

-- ============================================================================
-- TRIGGER: Auto-calculate expires_at
-- ============================================================================

CREATE OR REPLACE FUNCTION ref.cca_calculate_expiration()
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

CREATE TRIGGER trg_cca_calculate_expiration
    BEFORE INSERT OR UPDATE ON ref.ref_county_capability
    FOR EACH ROW
    EXECUTE FUNCTION ref.cca_calculate_expiration();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if a county profile is expired
CREATE OR REPLACE FUNCTION ref.cca_is_profile_expired(p_county_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT expires_at INTO v_expires_at
    FROM ref.ref_county_capability
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
CREATE OR REPLACE FUNCTION ref.cca_is_automation_viable(p_county_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_viable BOOLEAN;
    v_expired BOOLEAN;
BEGIN
    -- Check expiration first
    v_expired := ref.cca_is_profile_expired(p_county_id);

    IF v_expired THEN
        -- Expired profiles are not viable (force re-probe)
        RETURN FALSE;
    END IF;

    -- Get viability
    SELECT automation_viable INTO v_viable
    FROM ref.ref_county_capability
    WHERE county_id = p_county_id;

    RETURN COALESCE(v_viable, FALSE);
END;
$$;

-- Get effective capability (returns 'unknown' if expired)
CREATE OR REPLACE FUNCTION ref.cca_get_effective_capability(p_county_id INTEGER)
RETURNS TABLE (
    zoning_model ref.cca_zoning_model,
    permit_system ref.cca_permit_system,
    document_quality ref.cca_document_quality,
    automation_viable BOOLEAN,
    is_expired BOOLEAN,
    confidence_level ref.cca_confidence_level
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired BOOLEAN;
BEGIN
    v_expired := ref.cca_is_profile_expired(p_county_id);

    IF v_expired THEN
        -- Return all unknowns for expired profiles
        RETURN QUERY SELECT
            'unknown'::ref.cca_zoning_model,
            'unknown'::ref.cca_permit_system,
            'unknown'::ref.cca_document_quality,
            FALSE,
            TRUE,
            'low'::ref.cca_confidence_level;
    ELSE
        -- Return actual values
        RETURN QUERY SELECT
            ccp.zoning_model,
            ccp.permit_system,
            ccp.document_quality,
            ccp.automation_viable,
            FALSE,
            ccp.confidence_level
        FROM ref.ref_county_capability ccp
        WHERE ccp.county_id = p_county_id;
    END IF;
END;
$$;

-- ============================================================================
-- VIEW: County Capability Summary
-- ============================================================================

CREATE OR REPLACE VIEW ref.v_county_capability_summary AS
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
FROM ref.ref_county_capability ccp
JOIN ref.ref_county rc ON ccp.county_id = rc.county_id
JOIN ref.ref_state rs ON rc.state_id = rs.state_id;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ref.ref_county_capability ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "ref_county_capability_read" ON ref.ref_county_capability
    FOR SELECT TO authenticated USING (true);

-- Read access for anon (reference data)
CREATE POLICY "ref_county_capability_anon_read" ON ref.ref_county_capability
    FOR SELECT TO anon USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ref.ref_county_capability IS 'County Capability Asset (CCA) — Cross-pass reference for automation routing (12-month TTL)';
COMMENT ON COLUMN ref.ref_county_capability.zoning_model IS 'How zoning is structured (countywide/municipal/overlay/no_zoning/unknown)';
COMMENT ON COLUMN ref.ref_county_capability.permit_system IS 'How permits are accessed (api/portal_scrape/pdf_logs/manual_only/unknown)';
COMMENT ON COLUMN ref.ref_county_capability.document_quality IS 'Quality of online documents (structured_html/searchable_pdf/scanned_pdf/none/unknown)';
COMMENT ON COLUMN ref.ref_county_capability.automation_viable IS 'Computed: Can this county be automated?';
COMMENT ON COLUMN ref.ref_county_capability.expires_at IS 'Profile expiration (12 months after last_verified_at)';

-- ============================================================================
-- CROSS-PASS USAGE DOCUMENTATION
-- ============================================================================
--
-- Pass 0 reads CCA to determine signal viability:
--   - api/portal_scrape → Full automation allowed
--   - pdf_logs → Weak signal only
--   - manual_only → Human-only signal (low confidence)
--   - unknown → Try cheap probe first
--
-- Pass 2 reads CCA to determine hydration strategy:
--   - automation_viable = true → Firecrawl scraping
--   - automation_viable = false → Retell voice calls or manual queue
--
-- DOCTRINE: Pass 0 may NOT emit high-confidence signals from counties
-- whose capability is manual_only or unknown.
--
-- No pass mutates CCA directly. Only CapabilityProbe updates CCA.
-- ============================================================================
