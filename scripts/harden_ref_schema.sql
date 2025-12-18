-- ============================================================================
-- REF SCHEMA HARDENING SCRIPT
-- Replaces VIEW with static TABLE, geography-only columns
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP THE EXISTING VIEW
-- ============================================================================
DROP VIEW IF EXISTS ref.ref_zip CASCADE;

-- ============================================================================
-- STEP 2: CREATE STATIC ref.ref_zip TABLE (Geography Only)
-- ============================================================================
CREATE TABLE ref.ref_zip (
    zip_id CHAR(5) PRIMARY KEY,
    state_id INTEGER NOT NULL REFERENCES ref.ref_state(state_id) ON DELETE RESTRICT,
    lat NUMERIC(9,6),
    lon NUMERIC(10,6)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ref_zip_state ON ref.ref_zip(state_id);
CREATE INDEX IF NOT EXISTS idx_ref_zip_lat_lon ON ref.ref_zip(lat, lon);

-- ============================================================================
-- STEP 3: BACKFILL ref.ref_zip FROM zips_master
-- ============================================================================
INSERT INTO ref.ref_zip (zip_id, state_id, lat, lon)
SELECT
    LPAD(zm.zip::TEXT, 5, '0') AS zip_id,
    rs.state_id,
    zm.lat,
    zm.lng AS lon
FROM public.zips_master zm
JOIN ref.ref_state rs ON rs.state_code = zm.state
WHERE zm.zip IS NOT NULL
ON CONFLICT (zip_id) DO NOTHING;

-- ============================================================================
-- STEP 4: VERIFY ref.ref_county IS POPULATED
-- (Already populated, but ensure all counties have valid state references)
-- ============================================================================

-- Update any counties missing state_id (should be none if properly populated)
-- This is a safety check only

-- ============================================================================
-- STEP 5: REBUILD ref.ref_zip_county_map TO USE NEW TABLE
-- ============================================================================

-- Drop and recreate to ensure clean linkage
DROP TABLE IF EXISTS ref.ref_zip_county_map CASCADE;

CREATE TABLE ref.ref_zip_county_map (
    zip_id CHAR(5) NOT NULL REFERENCES ref.ref_zip(zip_id) ON DELETE RESTRICT,
    county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (zip_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_zip_county_map_county ON ref.ref_zip_county_map(county_id);
CREATE INDEX IF NOT EXISTS idx_ref_zip_county_map_primary ON ref.ref_zip_county_map(is_primary) WHERE is_primary = TRUE;

-- Populate ZIP to County mappings
INSERT INTO ref.ref_zip_county_map (zip_id, county_id, is_primary)
SELECT
    LPAD(zm.zip::TEXT, 5, '0') AS zip_id,
    rc.county_id,
    TRUE AS is_primary
FROM public.zips_master zm
JOIN ref.ref_county rc ON rc.county_fips = zm.county_fips
WHERE zm.county_fips IS NOT NULL
  AND EXISTS (SELECT 1 FROM ref.ref_zip rz WHERE rz.zip_id = LPAD(zm.zip::TEXT, 5, '0'))
ON CONFLICT (zip_id, county_id) DO NOTHING;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- V1: Verify ref.ref_zip has geography-only columns
SELECT
    column_name,
    data_type,
    CASE
        WHEN column_name IN ('zip_id', 'state_id', 'lat', 'lon') THEN 'VALID'
        ELSE 'VIOLATION'
    END AS status
FROM information_schema.columns
WHERE table_schema = 'ref' AND table_name = 'ref_zip'
ORDER BY ordinal_position;

-- V2: ZIP count verification
SELECT
    'ref.ref_zip' AS source,
    COUNT(*) AS zip_count
FROM ref.ref_zip
UNION ALL
SELECT
    'zips_master' AS source,
    COUNT(DISTINCT zip) AS zip_count
FROM public.zips_master;

-- V3: ref_county count
SELECT COUNT(*) AS county_count FROM ref.ref_county;

-- V4: ZIP-County mapping coverage
SELECT
    (SELECT COUNT(*) FROM ref.ref_zip) AS total_zips,
    (SELECT COUNT(DISTINCT zip_id) FROM ref.ref_zip_county_map) AS mapped_zips,
    (SELECT COUNT(*) FROM ref.ref_zip rz
     WHERE NOT EXISTS (SELECT 1 FROM ref.ref_zip_county_map m WHERE m.zip_id = rz.zip_id)) AS orphan_zips;

-- V5: Every ZIP has exactly one primary county
SELECT
    zip_id,
    COUNT(*) FILTER (WHERE is_primary = TRUE) AS primary_count
FROM ref.ref_zip_county_map
GROUP BY zip_id
HAVING COUNT(*) FILTER (WHERE is_primary = TRUE) != 1
LIMIT 10;

-- V6: No census/income/population columns in ref.ref_zip
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'ref'
  AND table_name = 'ref_zip'
  AND column_name IN ('population', 'income', 'median_income', 'income_household_median',
                       'home_value', 'census_data', 'demographic', 'county_name', 'city');

-- V7: All states in ref.ref_zip exist in ref.ref_state
SELECT COUNT(*) AS invalid_state_refs
FROM ref.ref_zip rz
WHERE NOT EXISTS (SELECT 1 FROM ref.ref_state rs WHERE rs.state_id = rz.state_id);
