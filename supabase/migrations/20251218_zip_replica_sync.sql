-- ============================================================================
-- ZIP REPLICA SYNC MIGRATION
-- Lovable.DAVE Execution Cache (Read-Only Replica of Neon ref_zip)
-- ============================================================================
-- Doctrine: Neon = Vault (authoritative), Lovable = Workbench (read-only cache)
-- ============================================================================

-- 1. Create ref schema if not exists
CREATE SCHEMA IF NOT EXISTS ref;

-- 2. Create ZIP replica table with sync metadata
CREATE TABLE IF NOT EXISTS ref.ref_zip_replica (
    -- Core geography (mirrors neon.ref_zip exactly)
    zip_id CHAR(5) PRIMARY KEY,
    state_id INTEGER NOT NULL,
    lat NUMERIC(9,6),
    lon NUMERIC(10,6),

    -- REQUIRED: Replica sync metadata
    source_version TEXT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_table TEXT NOT NULL DEFAULT 'neon.ref_zip',
    checksum TEXT NULL,

    -- Sync tracking
    sync_run_id UUID NULL,
    row_hash TEXT GENERATED ALWAYS AS (
        MD5(COALESCE(zip_id, '') || '|' ||
            COALESCE(state_id::TEXT, '') || '|' ||
            COALESCE(lat::TEXT, '') || '|' ||
            COALESCE(lon::TEXT, ''))
    ) STORED
);

-- 3. Create state replica table (required FK reference)
CREATE TABLE IF NOT EXISTS ref.ref_state_replica (
    state_id INTEGER PRIMARY KEY,
    country_id INTEGER NOT NULL DEFAULT 1,
    state_code CHAR(2) NOT NULL UNIQUE,
    state_name TEXT NOT NULL,

    -- Replica metadata
    source_version TEXT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_table TEXT NOT NULL DEFAULT 'neon.ref_state'
);

-- 4. Create sync version tracking table
CREATE TABLE IF NOT EXISTS ref.ref_sync_manifest (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL UNIQUE,
    source_version TEXT NOT NULL,
    source_checksum TEXT NULL,
    row_count INTEGER NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_by TEXT NOT NULL,
    sync_run_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'STALE', 'INVALID'))
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ref_zip_replica_state ON ref.ref_zip_replica(state_id);
CREATE INDEX IF NOT EXISTS idx_ref_zip_replica_synced ON ref.ref_zip_replica(synced_at);
CREATE INDEX IF NOT EXISTS idx_ref_zip_replica_version ON ref.ref_zip_replica(source_version);

-- ============================================================================
-- READ-ONLY ENFORCEMENT (Database-Level Policy)
-- ============================================================================

-- 6. Revoke write permissions from anon and authenticated roles
REVOKE INSERT, UPDATE, DELETE ON ref.ref_zip_replica FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ref.ref_zip_replica FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON ref.ref_state_replica FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ref.ref_state_replica FROM authenticated;

-- 7. Create read-only policy
ALTER TABLE ref.ref_zip_replica ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref.ref_state_replica ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for all authenticated users
CREATE POLICY "ref_zip_replica_read_only" ON ref.ref_zip_replica
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "ref_state_replica_read_only" ON ref.ref_state_replica
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- 8. Create service role for sync operations ONLY
-- (Service role bypasses RLS, used only by sync function)

-- ============================================================================
-- DRIFT DETECTION FUNCTION
-- ============================================================================

-- 9. Function to check replica version before execution
CREATE OR REPLACE FUNCTION ref.check_replica_version(
    p_expected_version TEXT,
    p_table_name TEXT DEFAULT 'ref_zip_replica'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_version TEXT;
    v_synced_at TIMESTAMPTZ;
    v_status TEXT;
    v_result JSONB;
BEGIN
    -- Get current manifest entry
    SELECT source_version, synced_at, status
    INTO v_current_version, v_synced_at, v_status
    FROM ref.ref_sync_manifest
    WHERE table_name = p_table_name;

    -- Check for missing manifest
    IF v_current_version IS NULL THEN
        v_result := jsonb_build_object(
            'valid', false,
            'error_code', 'REPLICA_NOT_INITIALIZED',
            'message', 'ZIP replica has not been synced from Neon'
        );
        RETURN v_result;
    END IF;

    -- Check for stale/invalid status
    IF v_status != 'ACTIVE' THEN
        v_result := jsonb_build_object(
            'valid', false,
            'error_code', 'REPLICA_' || v_status,
            'message', 'ZIP replica is marked as ' || v_status,
            'current_version', v_current_version,
            'synced_at', v_synced_at
        );
        RETURN v_result;
    END IF;

    -- Check version match
    IF v_current_version != p_expected_version THEN
        v_result := jsonb_build_object(
            'valid', false,
            'error_code', 'VERSION_MISMATCH',
            'message', 'Expected version ' || p_expected_version || ' but replica is at ' || v_current_version,
            'expected_version', p_expected_version,
            'current_version', v_current_version,
            'synced_at', v_synced_at
        );
        RETURN v_result;
    END IF;

    -- All checks passed
    v_result := jsonb_build_object(
        'valid', true,
        'current_version', v_current_version,
        'synced_at', v_synced_at
    );
    RETURN v_result;
END;
$$;

-- 10. Function to block execution on drift
CREATE OR REPLACE FUNCTION ref.require_valid_replica(
    p_expected_version TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_check JSONB;
BEGIN
    v_check := ref.check_replica_version(p_expected_version);

    IF NOT (v_check->>'valid')::boolean THEN
        -- Log failure event
        INSERT INTO public.master_failure_log (
            process_id,
            pass,
            spoke,
            error_code,
            severity,
            message,
            context,
            created_at
        ) VALUES (
            gen_random_uuid(),
            'PASS_1',
            'ZIP_REPLICA_CHECK',
            v_check->>'error_code',
            'critical',
            v_check->>'message',
            v_check,
            NOW()
        );

        -- Raise exception to block execution
        RAISE EXCEPTION 'ZIP replica validation failed: % (code: %)',
            v_check->>'message',
            v_check->>'error_code';
    END IF;
END;
$$;

-- ============================================================================
-- SYNC FUNCTION (Service Role Only)
-- ============================================================================

-- 11. Sync function - called from external sync process only
CREATE OR REPLACE FUNCTION ref.sync_zip_replica_from_neon(
    p_version TEXT,
    p_synced_by TEXT,
    p_zip_data JSONB,
    p_state_data JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_run_id UUID := gen_random_uuid();
    v_zip_count INTEGER;
    v_state_count INTEGER := 0;
    v_checksum TEXT;
BEGIN
    -- Mark existing manifest as STALE during sync
    UPDATE ref.ref_sync_manifest
    SET status = 'STALE'
    WHERE table_name IN ('ref_zip_replica', 'ref_state_replica');

    -- Sync states first (if provided)
    IF p_state_data IS NOT NULL THEN
        -- Truncate and reload
        TRUNCATE ref.ref_state_replica;

        INSERT INTO ref.ref_state_replica (
            state_id, country_id, state_code, state_name,
            source_version, synced_at, source_table
        )
        SELECT
            (item->>'state_id')::INTEGER,
            COALESCE((item->>'country_id')::INTEGER, 1),
            item->>'state_code',
            item->>'state_name',
            p_version,
            NOW(),
            'neon.ref_state'
        FROM jsonb_array_elements(p_state_data) AS item;

        GET DIAGNOSTICS v_state_count = ROW_COUNT;
    END IF;

    -- Truncate and reload ZIPs
    TRUNCATE ref.ref_zip_replica;

    INSERT INTO ref.ref_zip_replica (
        zip_id, state_id, lat, lon,
        source_version, synced_at, source_table, sync_run_id
    )
    SELECT
        item->>'zip_id',
        (item->>'state_id')::INTEGER,
        (item->>'lat')::NUMERIC,
        (item->>'lon')::NUMERIC,
        p_version,
        NOW(),
        'neon.ref_zip',
        v_run_id
    FROM jsonb_array_elements(p_zip_data) AS item;

    GET DIAGNOSTICS v_zip_count = ROW_COUNT;

    -- Calculate checksum
    SELECT MD5(STRING_AGG(row_hash, '|' ORDER BY zip_id))
    INTO v_checksum
    FROM ref.ref_zip_replica;

    -- Update manifest
    INSERT INTO ref.ref_sync_manifest (
        table_name, source_version, source_checksum, row_count,
        synced_at, synced_by, sync_run_id, status
    ) VALUES (
        'ref_zip_replica', p_version, v_checksum, v_zip_count,
        NOW(), p_synced_by, v_run_id, 'ACTIVE'
    )
    ON CONFLICT (table_name) DO UPDATE SET
        source_version = EXCLUDED.source_version,
        source_checksum = EXCLUDED.source_checksum,
        row_count = EXCLUDED.row_count,
        synced_at = EXCLUDED.synced_at,
        synced_by = EXCLUDED.synced_by,
        sync_run_id = EXCLUDED.sync_run_id,
        status = EXCLUDED.status;

    -- Update state manifest if synced
    IF v_state_count > 0 THEN
        INSERT INTO ref.ref_sync_manifest (
            table_name, source_version, source_checksum, row_count,
            synced_at, synced_by, sync_run_id, status
        ) VALUES (
            'ref_state_replica', p_version, NULL, v_state_count,
            NOW(), p_synced_by, v_run_id, 'ACTIVE'
        )
        ON CONFLICT (table_name) DO UPDATE SET
            source_version = EXCLUDED.source_version,
            row_count = EXCLUDED.row_count,
            synced_at = EXCLUDED.synced_at,
            synced_by = EXCLUDED.synced_by,
            sync_run_id = EXCLUDED.sync_run_id,
            status = EXCLUDED.status;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'run_id', v_run_id,
        'version', p_version,
        'zip_count', v_zip_count,
        'state_count', v_state_count,
        'checksum', v_checksum,
        'synced_at', NOW()
    );
END;
$$;

-- 12. Grant execute on sync function to service role only
REVOKE EXECUTE ON FUNCTION ref.sync_zip_replica_from_neon FROM PUBLIC;
-- Service role has implicit access

-- ============================================================================
-- VALIDATION VIEW
-- ============================================================================

-- 13. View to check replica health
CREATE OR REPLACE VIEW ref.replica_health AS
SELECT
    m.table_name,
    m.source_version,
    m.row_count,
    m.synced_at,
    m.synced_by,
    m.status,
    CASE
        WHEN m.status = 'ACTIVE' AND m.synced_at > NOW() - INTERVAL '24 hours' THEN 'HEALTHY'
        WHEN m.status = 'ACTIVE' AND m.synced_at > NOW() - INTERVAL '7 days' THEN 'WARN_STALE'
        WHEN m.status = 'STALE' THEN 'STALE'
        ELSE 'CRITICAL'
    END AS health_status,
    EXTRACT(EPOCH FROM (NOW() - m.synced_at)) / 3600 AS hours_since_sync
FROM ref.ref_sync_manifest m;

-- Grant read access to health view
GRANT SELECT ON ref.replica_health TO authenticated, anon;
