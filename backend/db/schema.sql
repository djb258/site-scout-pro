-- Storage Site Scouting Database Schema
-- Neon PostgreSQL

-- Main candidate table
CREATE TABLE IF NOT EXISTS site_candidate (
    id SERIAL PRIMARY KEY,
    address TEXT,
    county TEXT,
    state TEXT,
    zipcode TEXT,
    acreage NUMERIC,
    traffic_count INTEGER,
    population INTEGER,
    households INTEGER,
    sqft_required INTEGER,
    sqft_existing INTEGER,
    saturation_score INTEGER,
    county_difficulty INTEGER,
    shape_score INTEGER,
    slope_score INTEGER,
    access_score INTEGER,
    parcel_score INTEGER,
    floodplain BOOLEAN DEFAULT FALSE,
    rent_low NUMERIC,
    rent_med NUMERIC,
    rent_high NUMERIC,
    financial_score INTEGER,
    final_score INTEGER,
    uhaul_index INTEGER,
    dot_corridor BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

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

-- Process log for audit trail
CREATE TABLE IF NOT EXISTS process_log (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES site_candidate(id) ON DELETE CASCADE,
    stage TEXT,
    status TEXT,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Error log
CREATE TABLE IF NOT EXISTS error_log (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER,
    error_type TEXT,
    error_message TEXT,
    stack_trace TEXT,
    context_data JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_candidate_status ON site_candidate(status);
CREATE INDEX IF NOT EXISTS idx_site_candidate_county_state ON site_candidate(county, state);
CREATE INDEX IF NOT EXISTS idx_site_candidate_final_score ON site_candidate(final_score);
CREATE INDEX IF NOT EXISTS idx_process_log_candidate_id ON process_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_process_log_stage ON process_log(stage);
CREATE INDEX IF NOT EXISTS idx_error_log_candidate_id ON error_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at);

