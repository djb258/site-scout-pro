-- Migration 001: Initial schema
-- Creates base tables

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
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
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

-- Initial indexes
CREATE INDEX IF NOT EXISTS idx_site_candidate_status ON site_candidate(status);
CREATE INDEX IF NOT EXISTS idx_process_log_candidate_id ON process_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_error_log_candidate_id ON error_log(candidate_id);

