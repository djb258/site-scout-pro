-- ============================================================================
-- PASS 1 CENSUS SNAPSHOT TABLE
-- Time-Variant Demographic Data (Separate from Geography)
-- ============================================================================
-- Doctrine: Census/demographic data is TIME-VARIANT and lives here,
--           NOT in the ref schema (which is geography-only)
-- ============================================================================

-- 1. Create census snapshot table for Pass-1 demographic data
CREATE TABLE IF NOT EXISTS public.pass1_census_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ZIP reference (links to ref.ref_zip_replica)
    zip_code CHAR(5) NOT NULL,

    -- Vintage tracking (Census data changes over time)
    vintage_year INTEGER NOT NULL DEFAULT 2023,
    data_source TEXT NOT NULL DEFAULT 'ACS_5YR',

    -- Location context (denormalized for query performance)
    city TEXT,
    county_name TEXT,
    state_id CHAR(2),
    state_name TEXT,

    -- Population metrics
    population INTEGER,
    density NUMERIC(10,2),

    -- Age demographics
    age_median NUMERIC(5,2),
    male_pct NUMERIC(5,2),
    female_pct NUMERIC(5,2),

    -- Household metrics
    married_pct NUMERIC(5,2),
    family_size NUMERIC(4,2),

    -- Income metrics
    income_household_median INTEGER,
    income_household_six_figure_pct NUMERIC(5,2),

    -- Housing metrics
    home_ownership_pct NUMERIC(5,2),
    home_value_median INTEGER,
    rent_median INTEGER,

    -- Education & Employment
    education_college_or_above_pct NUMERIC(5,2),
    labor_force_participation_pct NUMERIC(5,2),
    unemployment_rate NUMERIC(5,2),

    -- Race demographics (optional)
    race_white_pct NUMERIC(5,2),
    race_black_pct NUMERIC(5,2),
    race_asian_pct NUMERIC(5,2),
    race_native_pct NUMERIC(5,2),
    race_pacific_pct NUMERIC(5,2),
    race_other_pct NUMERIC(5,2),
    race_multiple_pct NUMERIC(5,2),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one row per ZIP per vintage
    UNIQUE(zip_code, vintage_year)
);

-- 2. Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_census_snapshot_zip ON public.pass1_census_snapshot(zip_code);
CREATE INDEX IF NOT EXISTS idx_census_snapshot_vintage ON public.pass1_census_snapshot(vintage_year DESC);
CREATE INDEX IF NOT EXISTS idx_census_snapshot_state ON public.pass1_census_snapshot(state_id);
CREATE INDEX IF NOT EXISTS idx_census_snapshot_population ON public.pass1_census_snapshot(population DESC);

-- 3. Enable RLS
ALTER TABLE public.pass1_census_snapshot ENABLE ROW LEVEL SECURITY;

-- 4. Allow read access for all authenticated users
CREATE POLICY "pass1_census_snapshot_read" ON public.pass1_census_snapshot
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- 5. Allow service role to write (for census data sync)
CREATE POLICY "pass1_census_snapshot_write" ON public.pass1_census_snapshot
    FOR ALL
    TO service_role
    USING (true);

-- 6. Create helper function to get latest census data for a ZIP
CREATE OR REPLACE FUNCTION public.get_census_snapshot(
    p_zip_code TEXT
) RETURNS SETOF public.pass1_census_snapshot
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT *
    FROM public.pass1_census_snapshot
    WHERE zip_code = p_zip_code
    ORDER BY vintage_year DESC
    LIMIT 1;
$$;

-- 7. Grant execute on helper function
GRANT EXECUTE ON FUNCTION public.get_census_snapshot TO authenticated, anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.pass1_census_snapshot IS 'Time-variant census/demographic data for Pass-1 analysis. Geography lives in ref.ref_zip_replica.';
COMMENT ON COLUMN public.pass1_census_snapshot.vintage_year IS 'Census vintage year (e.g., 2023 for ACS 2023 5-year estimates)';
COMMENT ON COLUMN public.pass1_census_snapshot.data_source IS 'Source of census data: ACS_5YR, ACS_1YR, DECENNIAL';
