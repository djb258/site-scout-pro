-- Migration 003: Parcel tables
-- Adds parcel-related tables and columns

-- Add parcel columns to site_candidate
ALTER TABLE site_candidate
ADD COLUMN IF NOT EXISTS shape_score INTEGER,
ADD COLUMN IF NOT EXISTS slope_score INTEGER,
ADD COLUMN IF NOT EXISTS access_score INTEGER,
ADD COLUMN IF NOT EXISTS floodplain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rent_low NUMERIC,
ADD COLUMN IF NOT EXISTS rent_med NUMERIC,
ADD COLUMN IF NOT EXISTS rent_high NUMERIC,
ADD COLUMN IF NOT EXISTS dot_corridor BOOLEAN DEFAULT FALSE;

-- Rent comparison data
CREATE TABLE IF NOT EXISTS rent_comps (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES site_candidate(id) ON DELETE CASCADE,
    comp_address TEXT,
    comp_rent_low NUMERIC,
    comp_rent_med NUMERIC,
    comp_rent_high NUMERIC,
    distance_miles NUMERIC,
    created_at TIMESTAMP DEFAULT now()
);

-- Parcel screening results
CREATE TABLE IF NOT EXISTS parcel_screening (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES site_candidate(id) ON DELETE CASCADE,
    shape_score INTEGER,
    slope_score INTEGER,
    access_score INTEGER,
    floodplain BOOLEAN,
    soil_quality TEXT,
    rock_presence BOOLEAN,
    viable BOOLEAN,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_process_log_stage ON process_log(stage);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at);

