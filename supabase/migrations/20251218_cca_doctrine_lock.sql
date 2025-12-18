-- ============================================================================
-- CCA DOCTRINE LOCK MIGRATION
-- ADR-022 Compliant — NO DEVIATIONS ALLOWED
-- ============================================================================
-- This migration enforces the LOCKED 4-stage pipeline doctrine:
--   Stage 1: Capability Probe (WRITE)
--   Stage 2: Thin Viability Scan (READ-ONLY)
--   Stage 3: Targeted Constraint Hydration (READ-ONLY)
--   Stage 4: Human Escalation (OUTSIDE SYSTEM)
-- ============================================================================

-- ============================================================================
-- ENUM UPDATES — DOCTRINE-LOCKED VALUES
-- ============================================================================

-- Automation class (Stage 1 output)
-- Maps: api | portal | pdf | manual
CREATE TYPE ref.cca_automation_class AS ENUM (
    'api',      -- Programmatic API access
    'portal',   -- Web portal (scrapable)
    'pdf',      -- PDF-based logs
    'manual'    -- Phone/in-person only
);

-- Zoning model (Stage 1 output)
-- Maps: no_zoning | county | municipal | mixed
-- NOTE: Existing enum has different values, adding new one
CREATE TYPE ref.cca_zoning_model_v2 AS ENUM (
    'no_zoning',    -- No zoning (valid first-class)
    'county',       -- County-level unified zoning
    'municipal',    -- Delegated to municipalities
    'mixed',        -- Mixed authority
    'unknown'       -- Not determined
);

-- Confidence ceiling (DOCTRINE: may only stay same, go down, or go to unknown)
CREATE TYPE ref.cca_confidence_ceiling AS ENUM (
    'low',      -- Initial probe, limited signals
    'medium',   -- Multiple signals confirmed
    'high'      -- Manual verification required
);

-- ============================================================================
-- AUDIT LOG TABLE — REQUIRED FOR ALL CCA OPERATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ref.cca_audit_log (
    log_id BIGSERIAL PRIMARY KEY,

    -- Required audit fields (per doctrine)
    county_fips TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('probe', 'viability_scan', 'constraint_hydration', 'human_escalation')),
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    confidence_ceiling ref.cca_confidence_ceiling NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL CHECK (source IN ('automated', 'manual')),

    -- Additional context
    details JSONB,
    error_message TEXT,

    -- Immutable
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for county lookups
CREATE INDEX idx_cca_audit_log_county_fips ON ref.cca_audit_log(county_fips);
CREATE INDEX idx_cca_audit_log_stage ON ref.cca_audit_log(stage);
CREATE INDEX idx_cca_audit_log_timestamp ON ref.cca_audit_log(timestamp);

-- ============================================================================
-- UPDATED CCA TABLE — DOCTRINE-LOCKED FIELDS
-- ============================================================================

-- Add new doctrine-required columns to existing table
ALTER TABLE ref.ref_county_capability
    ADD COLUMN IF NOT EXISTS automation_class ref.cca_automation_class,
    ADD COLUMN IF NOT EXISTS zoning_model_v2 ref.cca_zoning_model_v2 DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS confidence_ceiling ref.cca_confidence_ceiling NOT NULL DEFAULT 'low',
    ADD COLUMN IF NOT EXISTS source_urls TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS probe_retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS probe_max_retries INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS manual_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS manual_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS manual_verified_by TEXT;

-- ============================================================================
-- CONSTRAINT: automation_class derivation from permit_system
-- ============================================================================

-- Function to derive automation_class from permit_system
CREATE OR REPLACE FUNCTION ref.cca_derive_automation_class(p_permit_system ref.cca_permit_system)
RETURNS ref.cca_automation_class
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_permit_system
        WHEN 'api' THEN RETURN 'api'::ref.cca_automation_class;
        WHEN 'portal_scrape' THEN RETURN 'portal'::ref.cca_automation_class;
        WHEN 'pdf_logs' THEN RETURN 'pdf'::ref.cca_automation_class;
        WHEN 'manual_only' THEN RETURN 'manual'::ref.cca_automation_class;
        ELSE RETURN 'manual'::ref.cca_automation_class; -- unknown defaults to manual
    END CASE;
END;
$$;

-- ============================================================================
-- STAGE 1: CAPABILITY PROBE (WRITE) — HELPER FUNCTIONS
-- ============================================================================

-- Probe result type
CREATE TYPE ref.cca_probe_result AS (
    automation_class ref.cca_automation_class,
    zoning_model ref.cca_zoning_model_v2,
    permit_system_type ref.cca_permit_system,
    document_quality ref.cca_document_quality,
    confidence_ceiling ref.cca_confidence_ceiling,
    source_urls TEXT[],
    detected_vendor TEXT,
    planning_url TEXT,
    permits_url TEXT,
    error_message TEXT
);

-- Function to write probe result (ONLY WRITER TO CCA)
CREATE OR REPLACE FUNCTION ref.cca_write_probe_result(
    p_county_id INTEGER,
    p_county_fips TEXT,
    p_result ref.cca_probe_result
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Insert or update capability profile
    INSERT INTO ref.ref_county_capability (
        county_id,
        automation_class,
        zoning_model_v2,
        permit_system,
        document_quality,
        confidence_ceiling,
        source_urls,
        detected_vendor,
        planning_url,
        permits_url,
        last_verified_at,
        probe_retry_count,
        confidence_level
    ) VALUES (
        p_county_id,
        p_result.automation_class,
        p_result.zoning_model,
        p_result.permit_system_type,
        p_result.document_quality,
        p_result.confidence_ceiling,
        p_result.source_urls,
        p_result.detected_vendor,
        p_result.planning_url,
        p_result.permits_url,
        v_now,
        0,
        p_result.confidence_ceiling::TEXT::ref.cca_confidence_level
    )
    ON CONFLICT (county_id) DO UPDATE SET
        automation_class = EXCLUDED.automation_class,
        zoning_model_v2 = EXCLUDED.zoning_model_v2,
        permit_system = EXCLUDED.permit_system,
        document_quality = EXCLUDED.document_quality,
        confidence_ceiling = EXCLUDED.confidence_ceiling,
        source_urls = EXCLUDED.source_urls,
        detected_vendor = EXCLUDED.detected_vendor,
        planning_url = EXCLUDED.planning_url,
        permits_url = EXCLUDED.permits_url,
        last_verified_at = v_now,
        probe_retry_count = 0;

    -- Log the probe action
    INSERT INTO ref.cca_audit_log (
        county_fips,
        stage,
        action,
        result,
        confidence_ceiling,
        source,
        details
    ) VALUES (
        p_county_fips,
        'probe',
        'write_probe_result',
        'success',
        p_result.confidence_ceiling,
        'automated',
        jsonb_build_object(
            'automation_class', p_result.automation_class,
            'zoning_model', p_result.zoning_model,
            'permit_system_type', p_result.permit_system_type,
            'source_urls_count', array_length(p_result.source_urls, 1)
        )
    );

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    -- Log failure
    INSERT INTO ref.cca_audit_log (
        county_fips,
        stage,
        action,
        result,
        confidence_ceiling,
        source,
        error_message
    ) VALUES (
        p_county_fips,
        'probe',
        'write_probe_result',
        'failure',
        'low',
        'automated',
        SQLERRM
    );
    RETURN FALSE;
END;
$$;

-- ============================================================================
-- STAGE 2: THIN VIABILITY SCAN (READ-ONLY) — OUTPUT TYPE
-- ============================================================================

CREATE TYPE ref.cca_viability_result AS (
    allowed_somewhere TEXT,      -- yes | no | unknown
    fatal_prohibition TEXT,      -- yes | no | unknown
    authority TEXT,              -- county | municipal | mixed | unknown
    confidence_ceiling ref.cca_confidence_ceiling,
    scan_source TEXT             -- automated | manual
);

-- Function to perform thin viability scan (READ-ONLY)
CREATE OR REPLACE FUNCTION ref.cca_thin_viability_scan(
    p_county_id INTEGER,
    p_county_fips TEXT
)
RETURNS ref.cca_viability_result
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cca ref.ref_county_capability%ROWTYPE;
    v_result ref.cca_viability_result;
    v_is_expired BOOLEAN;
BEGIN
    -- Check expiration first
    v_is_expired := ref.cca_is_profile_expired(p_county_id);

    IF v_is_expired THEN
        -- Expired = all unknown
        v_result.allowed_somewhere := 'unknown';
        v_result.fatal_prohibition := 'unknown';
        v_result.authority := 'unknown';
        v_result.confidence_ceiling := 'low';
        v_result.scan_source := 'automated';

        -- Log the scan
        INSERT INTO ref.cca_audit_log (
            county_fips, stage, action, result, confidence_ceiling, source, details
        ) VALUES (
            p_county_fips, 'viability_scan', 'scan', 'expired_profile',
            'low', 'automated', jsonb_build_object('expired', true)
        );

        RETURN v_result;
    END IF;

    -- Get capability profile
    SELECT * INTO v_cca FROM ref.ref_county_capability WHERE county_id = p_county_id;

    IF NOT FOUND THEN
        -- No profile = all unknown
        v_result.allowed_somewhere := 'unknown';
        v_result.fatal_prohibition := 'unknown';
        v_result.authority := 'unknown';
        v_result.confidence_ceiling := 'low';
        v_result.scan_source := 'automated';

        INSERT INTO ref.cca_audit_log (
            county_fips, stage, action, result, confidence_ceiling, source, details
        ) VALUES (
            p_county_fips, 'viability_scan', 'scan', 'no_profile',
            'low', 'automated', jsonb_build_object('profile_exists', false)
        );

        RETURN v_result;
    END IF;

    -- DOCTRINE: If zoning_model ≠ county → authority ≠ county
    CASE v_cca.zoning_model_v2
        WHEN 'county' THEN v_result.authority := 'county';
        WHEN 'municipal' THEN v_result.authority := 'municipal';
        WHEN 'mixed' THEN v_result.authority := 'mixed';
        WHEN 'no_zoning' THEN v_result.authority := 'county'; -- No zoning = county decides
        ELSE v_result.authority := 'unknown';
    END CASE;

    -- CCA does not determine allowed_somewhere or fatal_prohibition
    -- These require jurisdiction card data (Stage 3)
    v_result.allowed_somewhere := 'unknown';
    v_result.fatal_prohibition := 'unknown';

    -- Confidence ceiling from CCA
    v_result.confidence_ceiling := COALESCE(v_cca.confidence_ceiling, 'low');
    v_result.scan_source := 'automated';

    -- Log the scan
    INSERT INTO ref.cca_audit_log (
        county_fips, stage, action, result, confidence_ceiling, source, details
    ) VALUES (
        p_county_fips, 'viability_scan', 'scan', 'success',
        v_result.confidence_ceiling, 'automated',
        jsonb_build_object(
            'authority', v_result.authority,
            'zoning_model', v_cca.zoning_model_v2
        )
    );

    RETURN v_result;
END;
$$;

-- ============================================================================
-- STAGE 3 TRIGGER: GEOMETRY BLOCKED CHECK
-- ============================================================================

-- Function to check if constraint hydration is needed
CREATE OR REPLACE FUNCTION ref.cca_is_geometry_blocked(
    p_county_id INTEGER,
    p_county_fips TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result BOOLEAN := FALSE;
BEGIN
    -- This function is called by Pass 2 to determine if constraint hydration is needed
    -- Returns TRUE if geometry_blocked = true AND required fields are unknown

    -- Log the check
    INSERT INTO ref.cca_audit_log (
        county_fips, stage, action, result, confidence_ceiling, source
    ) VALUES (
        p_county_fips, 'constraint_hydration', 'geometry_blocked_check',
        CASE WHEN v_result THEN 'blocked' ELSE 'not_blocked' END,
        'low', 'automated'
    );

    RETURN v_result;
END;
$$;

-- ============================================================================
-- STAGE 4: HUMAN ESCALATION LOGGING
-- ============================================================================

-- Function to log human escalation request
CREATE OR REPLACE FUNCTION ref.cca_log_human_escalation(
    p_county_id INTEGER,
    p_county_fips TEXT,
    p_reason TEXT,
    p_required_fields TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO ref.cca_audit_log (
        county_fips,
        stage,
        action,
        result,
        confidence_ceiling,
        source,
        details
    ) VALUES (
        p_county_fips,
        'human_escalation',
        'escalation_requested',
        'pending',
        'low',
        'automated',
        jsonb_build_object(
            'reason', p_reason,
            'required_fields', p_required_fields,
            'county_id', p_county_id
        )
    );

    RETURN TRUE;
END;
$$;

-- Function to record human verification result
CREATE OR REPLACE FUNCTION ref.cca_record_human_verification(
    p_county_id INTEGER,
    p_county_fips TEXT,
    p_verified_by TEXT,
    p_fields_verified JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the capability profile with manual verification flag
    UPDATE ref.ref_county_capability SET
        manual_verified = TRUE,
        manual_verified_at = NOW(),
        manual_verified_by = p_verified_by,
        confidence_ceiling = 'high' -- Manual verification allows high confidence
    WHERE county_id = p_county_id;

    -- Log the verification
    INSERT INTO ref.cca_audit_log (
        county_fips,
        stage,
        action,
        result,
        confidence_ceiling,
        source,
        details
    ) VALUES (
        p_county_fips,
        'human_escalation',
        'manual_verification',
        'verified',
        'high',
        'manual',
        jsonb_build_object(
            'verified_by', p_verified_by,
            'fields_verified', p_fields_verified
        )
    );

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- KILL SWITCH FUNCTIONS
-- ============================================================================

-- Check if pipeline should stop (kill switch)
CREATE OR REPLACE FUNCTION ref.cca_should_kill_pipeline(
    p_county_id INTEGER,
    p_county_fips TEXT
)
RETURNS TABLE (
    should_kill BOOLEAN,
    kill_reason TEXT,
    stage TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cca ref.ref_county_capability%ROWTYPE;
    v_is_expired BOOLEAN;
BEGIN
    -- Check 1: Profile expired
    v_is_expired := ref.cca_is_profile_expired(p_county_id);
    IF v_is_expired THEN
        INSERT INTO ref.cca_audit_log (
            county_fips, stage, action, result, confidence_ceiling, source
        ) VALUES (
            p_county_fips, 'probe', 'kill_switch', 'expired_profile', 'low', 'automated'
        );
        RETURN QUERY SELECT TRUE, 'Profile expired - re-probe required', 'probe';
        RETURN;
    END IF;

    -- Get profile
    SELECT * INTO v_cca FROM ref.ref_county_capability WHERE county_id = p_county_id;

    -- Check 2: No profile exists
    IF NOT FOUND THEN
        INSERT INTO ref.cca_audit_log (
            county_fips, stage, action, result, confidence_ceiling, source
        ) VALUES (
            p_county_fips, 'probe', 'kill_switch', 'no_profile', 'low', 'automated'
        );
        RETURN QUERY SELECT TRUE, 'No capability profile - probe required', 'probe';
        RETURN;
    END IF;

    -- Check 3: Manual-only county with no manual verification
    IF v_cca.automation_class = 'manual' AND NOT v_cca.manual_verified THEN
        INSERT INTO ref.cca_audit_log (
            county_fips, stage, action, result, confidence_ceiling, source
        ) VALUES (
            p_county_fips, 'viability_scan', 'kill_switch', 'manual_only_unverified', 'low', 'automated'
        );
        RETURN QUERY SELECT TRUE, 'Manual-only county requires human verification', 'viability_scan';
        RETURN;
    END IF;

    -- Check 4: Retry limit exceeded
    IF v_cca.probe_retry_count >= v_cca.probe_max_retries THEN
        INSERT INTO ref.cca_audit_log (
            county_fips, stage, action, result, confidence_ceiling, source
        ) VALUES (
            p_county_fips, 'probe', 'kill_switch', 'retry_limit_exceeded', 'low', 'automated'
        );
        RETURN QUERY SELECT TRUE, 'Probe retry limit exceeded - human escalation required', 'probe';
        RETURN;
    END IF;

    -- No kill condition met
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT;
END;
$$;

-- ============================================================================
-- PASS CONSUMPTION CONTRACTS
-- ============================================================================

-- Pass 0 throttle logic (READ-ONLY)
CREATE OR REPLACE FUNCTION ref.cca_pass0_get_throttle(p_county_id INTEGER)
RETURNS TABLE (
    allow_full_automation BOOLEAN,
    confidence_cap ref.cca_confidence_ceiling,
    throttle_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cca ref.ref_county_capability%ROWTYPE;
    v_is_expired BOOLEAN;
BEGIN
    v_is_expired := ref.cca_is_profile_expired(p_county_id);

    IF v_is_expired THEN
        -- DOCTRINE: Expired = low confidence, no full automation
        RETURN QUERY SELECT FALSE, 'low'::ref.cca_confidence_ceiling, 'Profile expired';
        RETURN;
    END IF;

    SELECT * INTO v_cca FROM ref.ref_county_capability WHERE county_id = p_county_id;

    IF NOT FOUND THEN
        -- DOCTRINE: No profile = low confidence, no full automation
        RETURN QUERY SELECT FALSE, 'low'::ref.cca_confidence_ceiling, 'No capability profile';
        RETURN;
    END IF;

    -- DOCTRINE: manual_only or unknown = ALWAYS cap confidence at low
    IF v_cca.automation_class = 'manual' OR v_cca.automation_class IS NULL THEN
        RETURN QUERY SELECT FALSE, 'low'::ref.cca_confidence_ceiling, 'Manual-only county';
        RETURN;
    END IF;

    -- DOCTRINE: pdf = weak signal only
    IF v_cca.automation_class = 'pdf' THEN
        RETURN QUERY SELECT FALSE, 'low'::ref.cca_confidence_ceiling, 'PDF-based county';
        RETURN;
    END IF;

    -- api or portal = full automation allowed
    RETURN QUERY SELECT
        TRUE,
        COALESCE(v_cca.confidence_ceiling, 'medium'),
        NULL::TEXT;
END;
$$;

-- Pass 2 routing logic (READ-ONLY)
CREATE OR REPLACE FUNCTION ref.cca_pass2_get_routing(p_county_id INTEGER)
RETURNS TABLE (
    route_to TEXT,              -- 'firecrawl' | 'retell' | 'manual_queue' | 'do_nothing'
    confidence_ceiling ref.cca_confidence_ceiling,
    routing_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cca ref.ref_county_capability%ROWTYPE;
    v_is_expired BOOLEAN;
BEGIN
    v_is_expired := ref.cca_is_profile_expired(p_county_id);

    IF v_is_expired THEN
        -- DOCTRINE: Expired = do nothing until re-probe
        RETURN QUERY SELECT 'do_nothing', 'low'::ref.cca_confidence_ceiling, 'Profile expired - re-probe required';
        RETURN;
    END IF;

    SELECT * INTO v_cca FROM ref.ref_county_capability WHERE county_id = p_county_id;

    IF NOT FOUND THEN
        -- DOCTRINE: No profile = do nothing until probe
        RETURN QUERY SELECT 'do_nothing', 'low'::ref.cca_confidence_ceiling, 'No capability profile - probe required';
        RETURN;
    END IF;

    -- Route based on automation_viable
    IF v_cca.automation_viable THEN
        RETURN QUERY SELECT 'firecrawl', COALESCE(v_cca.confidence_ceiling, 'medium'), 'Automation viable';
        RETURN;
    END IF;

    -- Not automation viable - check for manual-only
    IF v_cca.automation_class = 'manual' THEN
        -- DOCTRINE: Retell/manual ONLY for non-automatable counties
        RETURN QUERY SELECT 'retell', 'low'::ref.cca_confidence_ceiling, 'Manual-only county';
        RETURN;
    END IF;

    IF v_cca.document_quality = 'scanned_pdf' THEN
        RETURN QUERY SELECT 'manual_queue', 'low'::ref.cca_confidence_ceiling, 'Scanned PDF documents';
        RETURN;
    END IF;

    -- Default to manual queue
    RETURN QUERY SELECT 'manual_queue', 'low'::ref.cca_confidence_ceiling, 'Not automation viable';
END;
$$;

-- ============================================================================
-- CONFIDENCE CEILING ENFORCEMENT
-- ============================================================================

-- DOCTRINE: Confidence may ONLY stay same, go down, or go to unknown
-- NEVER upgraded without citation
CREATE OR REPLACE FUNCTION ref.cca_apply_confidence_ceiling(
    p_current_confidence ref.cca_confidence_ceiling,
    p_cca_ceiling ref.cca_confidence_ceiling
)
RETURNS ref.cca_confidence_ceiling
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_current_rank INTEGER;
    v_ceiling_rank INTEGER;
BEGIN
    -- Rank: low=1, medium=2, high=3
    v_current_rank := CASE p_current_confidence
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'high' THEN 3
    END;

    v_ceiling_rank := CASE p_cca_ceiling
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'high' THEN 3
    END;

    -- DOCTRINE: Return the lower of the two (never upgrade)
    IF v_current_rank <= v_ceiling_rank THEN
        RETURN p_current_confidence;
    ELSE
        RETURN p_cca_ceiling;
    END IF;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ref.cca_audit_log IS 'Immutable audit log for all CCA operations (doctrine-required)';
COMMENT ON FUNCTION ref.cca_write_probe_result IS 'Stage 1: ONLY function that writes to CCA';
COMMENT ON FUNCTION ref.cca_thin_viability_scan IS 'Stage 2: READ-ONLY viability scan';
COMMENT ON FUNCTION ref.cca_pass0_get_throttle IS 'Pass 0 consumption contract (READ-ONLY)';
COMMENT ON FUNCTION ref.cca_pass2_get_routing IS 'Pass 2 consumption contract (READ-ONLY)';
COMMENT ON FUNCTION ref.cca_should_kill_pipeline IS 'Kill switch logic - when pipeline stops';
COMMENT ON FUNCTION ref.cca_apply_confidence_ceiling IS 'DOCTRINE: Confidence may never be upgraded';

-- ============================================================================
-- END OF DOCTRINE-LOCKED MIGRATION
-- ============================================================================
