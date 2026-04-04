-- Migration 002: Scoring tables
-- Adds scoring-related tables and columns

-- Add scoring columns to site_candidate
ALTER TABLE site_candidate
ADD COLUMN IF NOT EXISTS sqft_required INTEGER,
ADD COLUMN IF NOT EXISTS sqft_existing INTEGER,
ADD COLUMN IF NOT EXISTS saturation_score INTEGER,
ADD COLUMN IF NOT EXISTS county_difficulty INTEGER,
ADD COLUMN IF NOT EXISTS parcel_score INTEGER,
ADD COLUMN IF NOT EXISTS financial_score INTEGER,
ADD COLUMN IF NOT EXISTS final_score INTEGER,
ADD COLUMN IF NOT EXISTS uhaul_index INTEGER;

-- Population metrics
CREATE TABLE IF NOT EXISTS population_metrics (
    id SERIAL PRIMARY KEY,
    county TEXT,
    state TEXT,
    population INTEGER,
    households INTEGER,
    population_growth_rate NUMERIC,
    household_density NUMERIC,
    year INTEGER,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(county, state, year)
);

-- County scoring
CREATE TABLE IF NOT EXISTS county_score (
    id SERIAL PRIMARY KEY,
    county TEXT,
    state TEXT,
    zoning_difficulty INTEGER,
    permitting_speed INTEGER,
    stormwater_difficulty INTEGER,
    overall_difficulty INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(county, state)
);

-- Saturation matrix
CREATE TABLE IF NOT EXISTS saturation_matrix (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES site_candidate(id) ON DELETE CASCADE,
    population INTEGER,
    sqft_required INTEGER,
    sqft_existing INTEGER,
    saturation_ratio NUMERIC,
    saturation_score INTEGER,
    market_status TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_candidate_final_score ON site_candidate(final_score);
CREATE INDEX IF NOT EXISTS idx_site_candidate_county_state ON site_candidate(county, state);

