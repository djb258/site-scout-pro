-- Static Reference Schema for Storage Viability Engine
-- Creates ref schema with geography and asset intent tables
-- References existing zips_master table in public schema

CREATE SCHEMA IF NOT EXISTS ref;

-- 1. Country (root geography)
CREATE TABLE IF NOT EXISTS ref.ref_country (
    country_id INTEGER PRIMARY KEY,
    country_name TEXT NOT NULL UNIQUE
);

-- 2. State (references country)
CREATE TABLE IF NOT EXISTS ref.ref_state (
    state_id INTEGER PRIMARY KEY,
    country_id INTEGER NOT NULL REFERENCES ref.ref_country(country_id) ON DELETE RESTRICT,
    state_code CHAR(2) NOT NULL UNIQUE,
    state_name TEXT NOT NULL
);

-- 3. County (references state)
CREATE TABLE IF NOT EXISTS ref.ref_county (
    county_id INTEGER PRIMARY KEY,
    state_id INTEGER NOT NULL REFERENCES ref.ref_state(state_id) ON DELETE RESTRICT,
    county_fips CHAR(5) NOT NULL UNIQUE,
    county_name TEXT NOT NULL
);

-- 4. ZIP Table (Geography Only - Hardened 2025-12-18)
-- FORBIDDEN: population, income, census_data, demographic fields
CREATE TABLE IF NOT EXISTS ref.ref_zip (
    zip_id CHAR(5) PRIMARY KEY,
    state_id INTEGER NOT NULL REFERENCES ref.ref_state(state_id) ON DELETE RESTRICT,
    lat NUMERIC(9,6),
    lon NUMERIC(10,6)
);

CREATE INDEX IF NOT EXISTS idx_ref_zip_state ON ref.ref_zip(state_id);
CREATE INDEX IF NOT EXISTS idx_ref_zip_lat_lon ON ref.ref_zip(lat, lon);

-- 4b. ZIP to County mapping table
CREATE TABLE IF NOT EXISTS ref.ref_zip_county_map (
    zip_id CHAR(5) NOT NULL REFERENCES ref.ref_zip(zip_id) ON DELETE RESTRICT,
    county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (zip_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_zip_county_map_county ON ref.ref_zip_county_map(county_id);

-- 5. Asset Class
CREATE TABLE IF NOT EXISTS ref.ref_asset_class (
    asset_class_id INTEGER PRIMARY KEY,
    asset_class_code TEXT NOT NULL UNIQUE,
    asset_class_name TEXT NOT NULL,
    description TEXT
);

-- 6. Unit Type
CREATE TABLE IF NOT EXISTS ref.ref_unit_type (
    unit_type_id INTEGER PRIMARY KEY,
    unit_type_code TEXT NOT NULL UNIQUE,
    unit_type_name TEXT NOT NULL,
    climate_controlled BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7. Unit Size
CREATE TABLE IF NOT EXISTS ref.ref_unit_size (
    unit_size_id INTEGER PRIMARY KEY,
    unit_size_code TEXT NOT NULL UNIQUE,
    width_ft NUMERIC(5,1) NOT NULL,
    depth_ft NUMERIC(5,1) NOT NULL,
    sqft_computed NUMERIC(7,1) GENERATED ALWAYS AS (width_ft * depth_ft) STORED
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ref_state_country ON ref.ref_state(country_id);
CREATE INDEX IF NOT EXISTS idx_ref_county_state ON ref.ref_county(state_id);
CREATE INDEX IF NOT EXISTS idx_ref_county_fips ON ref.ref_county(county_fips);

-- Seed data: US Country
INSERT INTO ref.ref_country (country_id, country_name)
VALUES (1, 'United States')
ON CONFLICT (country_id) DO NOTHING;

-- Seed data: US States
INSERT INTO ref.ref_state (state_id, country_id, state_code, state_name) VALUES
(1, 1, 'AL', 'Alabama'), (2, 1, 'AK', 'Alaska'), (3, 1, 'AZ', 'Arizona'),
(4, 1, 'AR', 'Arkansas'), (5, 1, 'CA', 'California'), (6, 1, 'CO', 'Colorado'),
(7, 1, 'CT', 'Connecticut'), (8, 1, 'DE', 'Delaware'), (9, 1, 'FL', 'Florida'),
(10, 1, 'GA', 'Georgia'), (11, 1, 'HI', 'Hawaii'), (12, 1, 'ID', 'Idaho'),
(13, 1, 'IL', 'Illinois'), (14, 1, 'IN', 'Indiana'), (15, 1, 'IA', 'Iowa'),
(16, 1, 'KS', 'Kansas'), (17, 1, 'KY', 'Kentucky'), (18, 1, 'LA', 'Louisiana'),
(19, 1, 'ME', 'Maine'), (20, 1, 'MD', 'Maryland'), (21, 1, 'MA', 'Massachusetts'),
(22, 1, 'MI', 'Michigan'), (23, 1, 'MN', 'Minnesota'), (24, 1, 'MS', 'Mississippi'),
(25, 1, 'MO', 'Missouri'), (26, 1, 'MT', 'Montana'), (27, 1, 'NE', 'Nebraska'),
(28, 1, 'NV', 'Nevada'), (29, 1, 'NH', 'New Hampshire'), (30, 1, 'NJ', 'New Jersey'),
(31, 1, 'NM', 'New Mexico'), (32, 1, 'NY', 'New York'), (33, 1, 'NC', 'North Carolina'),
(34, 1, 'ND', 'North Dakota'), (35, 1, 'OH', 'Ohio'), (36, 1, 'OK', 'Oklahoma'),
(37, 1, 'OR', 'Oregon'), (38, 1, 'PA', 'Pennsylvania'), (39, 1, 'RI', 'Rhode Island'),
(40, 1, 'SC', 'South Carolina'), (41, 1, 'SD', 'South Dakota'), (42, 1, 'TN', 'Tennessee'),
(43, 1, 'TX', 'Texas'), (44, 1, 'UT', 'Utah'), (45, 1, 'VT', 'Vermont'),
(46, 1, 'VA', 'Virginia'), (47, 1, 'WA', 'Washington'), (48, 1, 'WV', 'West Virginia'),
(49, 1, 'WI', 'Wisconsin'), (50, 1, 'WY', 'Wyoming'), (51, 1, 'DC', 'District of Columbia')
ON CONFLICT (state_id) DO NOTHING;

-- Seed data: Asset Classes
INSERT INTO ref.ref_asset_class (asset_class_id, asset_class_code, asset_class_name, description) VALUES
(1, 'SSF', 'Self-Storage Facility', 'Traditional self-storage facility'),
(2, 'CSS', 'Climate-Controlled Storage', 'Climate-controlled self-storage'),
(3, 'RV', 'RV/Boat Storage', 'Vehicle and boat storage'),
(4, 'MIXED', 'Mixed-Use Storage', 'Combination of storage types')
ON CONFLICT (asset_class_id) DO NOTHING;

-- Seed data: Unit Types
INSERT INTO ref.ref_unit_type (unit_type_id, unit_type_code, unit_type_name, climate_controlled) VALUES
(1, 'STD', 'Standard', FALSE),
(2, 'CC', 'Climate Controlled', TRUE),
(3, 'DU', 'Drive-Up', FALSE),
(4, 'INT', 'Interior', FALSE),
(5, 'INT-CC', 'Interior Climate Controlled', TRUE)
ON CONFLICT (unit_type_id) DO NOTHING;

-- Seed data: Standard Unit Sizes
INSERT INTO ref.ref_unit_size (unit_size_id, unit_size_code, width_ft, depth_ft) VALUES
(1, '5x5', 5.0, 5.0),
(2, '5x10', 5.0, 10.0),
(3, '10x10', 10.0, 10.0),
(4, '10x15', 10.0, 15.0),
(5, '10x20', 10.0, 20.0),
(6, '10x25', 10.0, 25.0),
(7, '10x30', 10.0, 30.0),
(8, '15x20', 15.0, 20.0),
(9, '20x20', 20.0, 20.0)
ON CONFLICT (unit_size_id) DO NOTHING;
