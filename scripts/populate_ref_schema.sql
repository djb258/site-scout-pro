-- ============================================================================
-- PART A: POPULATE STATIC REFERENCE TABLES
-- ============================================================================

-- A1: Populate ref_county from zips_master (3218 counties)
INSERT INTO ref.ref_county (county_id, state_id, county_fips, county_name)
SELECT
    ROW_NUMBER() OVER (ORDER BY zm.county_fips)::INTEGER AS county_id,
    rs.state_id,
    zm.county_fips,
    zm.county_name
FROM (
    SELECT DISTINCT county_fips, county_name, state
    FROM public.zips_master
    WHERE county_fips IS NOT NULL
) zm
JOIN ref.ref_state rs ON rs.state_code = zm.state
ON CONFLICT (county_fips) DO NOTHING;

-- A2: Create ref_zip_county_map (ZIP to primary county mapping)
CREATE TABLE IF NOT EXISTS ref.ref_zip_county_map (
    zip_code CHAR(5) PRIMARY KEY,
    county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_zip_county_map_county ON ref.ref_zip_county_map(county_id);

-- A3: Populate ref_zip_county_map from zips_master
INSERT INTO ref.ref_zip_county_map (zip_code, county_id, is_primary)
SELECT
    zm.zip,
    rc.county_id,
    TRUE
FROM public.zips_master zm
JOIN ref.ref_county rc ON rc.county_fips = zm.county_fips
WHERE zm.county_fips IS NOT NULL
ON CONFLICT (zip_code) DO NOTHING;

-- ============================================================================
-- PART B: PASS 1 CENSUS SNAPSHOT TABLE (Time-Variant Data)
-- ============================================================================

-- B1: Create pass1_census_snapshot table (NOT in ref schema)
CREATE TABLE IF NOT EXISTS public.pass1_census_snapshot (
    snapshot_id SERIAL PRIMARY KEY,
    zip_code CHAR(5) NOT NULL,
    vintage_year INTEGER NOT NULL,
    retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    run_id UUID,

    -- Census metrics (ACS 5-Year Estimates)
    population INTEGER,
    population_density NUMERIC(10,2),
    median_age NUMERIC(4,1),
    median_household_income INTEGER,
    median_home_value INTEGER,
    median_rent INTEGER,
    housing_units INTEGER,
    occupied_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    vacancy_rate NUMERIC(5,2),
    education_bachelors_plus NUMERIC(5,2),
    unemployment_rate NUMERIC(5,2),

    -- Household composition
    avg_household_size NUMERIC(3,1),
    family_households INTEGER,
    nonfamily_households INTEGER,

    -- Age distribution
    pop_under_18 INTEGER,
    pop_18_to_34 INTEGER,
    pop_35_to_54 INTEGER,
    pop_55_to_64 INTEGER,
    pop_65_plus INTEGER,

    -- Housing characteristics
    single_family_units INTEGER,
    multi_family_units INTEGER,
    mobile_homes INTEGER,

    -- Income distribution
    households_under_25k INTEGER,
    households_25k_to_50k INTEGER,
    households_50k_to_75k INTEGER,
    households_75k_to_100k INTEGER,
    households_100k_plus INTEGER,

    -- Data quality
    source TEXT DEFAULT 'CENSUS_ACS5',
    margin_of_error_flag BOOLEAN DEFAULT FALSE,

    UNIQUE(zip_code, vintage_year, run_id)
);

CREATE INDEX IF NOT EXISTS idx_pass1_census_zip ON public.pass1_census_snapshot(zip_code);
CREATE INDEX IF NOT EXISTS idx_pass1_census_vintage ON public.pass1_census_snapshot(vintage_year);
CREATE INDEX IF NOT EXISTS idx_pass1_census_run ON public.pass1_census_snapshot(run_id);
CREATE INDEX IF NOT EXISTS idx_pass1_census_retrieved ON public.pass1_census_snapshot(retrieved_at);

-- B2: Create pass1_census_skip_log for tracking skipped ZIPs
CREATE TABLE IF NOT EXISTS public.pass1_census_skip_log (
    id SERIAL PRIMARY KEY,
    zip_code CHAR(5) NOT NULL,
    run_id UUID,
    skip_reason TEXT NOT NULL,
    skipped_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pass1_skip_run ON public.pass1_census_skip_log(run_id);

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- V1: Verify all ref tables populated
SELECT 'ref_country' AS table_name, COUNT(*) AS row_count FROM ref.ref_country
UNION ALL
SELECT 'ref_state', COUNT(*) FROM ref.ref_state
UNION ALL
SELECT 'ref_county', COUNT(*) FROM ref.ref_county
UNION ALL
SELECT 'ref_asset_class', COUNT(*) FROM ref.ref_asset_class
UNION ALL
SELECT 'ref_unit_type', COUNT(*) FROM ref.ref_unit_type
UNION ALL
SELECT 'ref_unit_size', COUNT(*) FROM ref.ref_unit_size
UNION ALL
SELECT 'ref_zip_county_map', COUNT(*) FROM ref.ref_zip_county_map;

-- V2: Verify all ZIPs have county mapping
SELECT
    (SELECT COUNT(*) FROM public.zips_master WHERE county_fips IS NOT NULL) AS zips_with_county,
    (SELECT COUNT(*) FROM ref.ref_zip_county_map) AS mapped_zips,
    (SELECT COUNT(*) FROM public.zips_master WHERE county_fips IS NULL) AS zips_without_county;

-- V3: Verify no Census data in ref schema
SELECT
    'ref.ref_country' AS table_name,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'ref' AND table_name = 'ref_country'
     AND column_name IN ('population', 'median_income', 'census_data')) AS census_columns
UNION ALL
SELECT 'ref.ref_state',
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'ref' AND table_name = 'ref_state'
     AND column_name IN ('population', 'median_income', 'census_data'))
UNION ALL
SELECT 'ref.ref_county',
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'ref' AND table_name = 'ref_county'
     AND column_name IN ('population', 'median_income', 'census_data'))
UNION ALL
SELECT 'ref.ref_zip_county_map',
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'ref' AND table_name = 'ref_zip_county_map'
     AND column_name IN ('population', 'median_income', 'census_data'));

-- V4: Verify no orphan ZIPs (all mapped ZIPs exist in zips_master)
SELECT COUNT(*) AS orphan_count
FROM ref.ref_zip_county_map m
LEFT JOIN public.zips_master z ON m.zip_code = z.zip
WHERE z.zip IS NULL;
