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

-- Error log (legacy - kept for backwards compatibility)
CREATE TABLE IF NOT EXISTS error_log (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER,
    error_type TEXT,
    error_message TEXT,
    stack_trace TEXT,
    context_data JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- =============================================================================
-- MASTER FAILURE LOG
-- Centralized failure tracking across all passes (Pass-0 through Pass-3)
-- ADR: ADR-013-master-failure-log.md
-- Doctrine ID: SS.00.FL
-- =============================================================================

CREATE TABLE IF NOT EXISTS master_failure_log (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Process Identification (CRITICAL for isolation)
    process_id UUID NOT NULL,              -- Unique ID for this specific run/execution
    opportunity_id TEXT,                   -- Which site/opportunity this relates to

    -- Location Identification (WHERE did it fail?)
    pass TEXT NOT NULL,                    -- PASS0, PASS1, PASS1_5, PASS2, PASS3
    spoke TEXT,                            -- Which spoke within the pass
    orchestrator_run_id TEXT,              -- Links to specific orchestrator execution

    -- Error Classification (WHAT failed?)
    error_code TEXT NOT NULL,              -- Standardized code (e.g., DSCR_BELOW_MINIMUM)
    error_category TEXT,                   -- API_ERROR, VALIDATION_ERROR, TIMEOUT, FATAL_FLAW
    severity TEXT NOT NULL,                -- info, warning, error, critical

    -- Error Details (WHY did it fail?)
    message TEXT NOT NULL,                 -- Human-readable description
    stack_trace TEXT,                      -- Full stack trace if available

    -- Context (WHAT was happening when it failed?)
    input_payload JSONB,                   -- What inputs were provided to the spoke
    output_payload JSONB,                  -- Partial output if any was generated
    context JSONB,                         -- Additional metadata

    -- Resolution Tracking
    resolution_status TEXT DEFAULT 'open', -- open, acknowledged, in_progress, resolved, auto_repaired
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    resolution_notes TEXT,

    -- Auto-Repair Tracking
    auto_repair_attempted BOOLEAN DEFAULT FALSE,
    auto_repair_succeeded BOOLEAN,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),

    -- Constraints
    CONSTRAINT valid_pass CHECK (pass IN ('PASS0', 'PASS1', 'PASS1_5', 'PASS2', 'PASS3', 'DATA_LAYER', 'SYSTEM')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_resolution_status CHECK (resolution_status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'auto_repaired'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_candidate_status ON site_candidate(status);
CREATE INDEX IF NOT EXISTS idx_site_candidate_county_state ON site_candidate(county, state);
CREATE INDEX IF NOT EXISTS idx_site_candidate_final_score ON site_candidate(final_score);
CREATE INDEX IF NOT EXISTS idx_process_log_candidate_id ON process_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_process_log_stage ON process_log(stage);
CREATE INDEX IF NOT EXISTS idx_error_log_candidate_id ON error_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at);

-- Master Failure Log indexes
CREATE INDEX IF NOT EXISTS idx_mfl_process_id ON master_failure_log(process_id);
CREATE INDEX IF NOT EXISTS idx_mfl_opportunity_id ON master_failure_log(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_mfl_pass ON master_failure_log(pass);
CREATE INDEX IF NOT EXISTS idx_mfl_pass_spoke ON master_failure_log(pass, spoke);
CREATE INDEX IF NOT EXISTS idx_mfl_severity ON master_failure_log(severity);
CREATE INDEX IF NOT EXISTS idx_mfl_error_code ON master_failure_log(error_code);
CREATE INDEX IF NOT EXISTS idx_mfl_resolution_status ON master_failure_log(resolution_status);
CREATE INDEX IF NOT EXISTS idx_mfl_created_at ON master_failure_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfl_troubleshoot ON master_failure_log(pass, severity, resolution_status, created_at DESC);

