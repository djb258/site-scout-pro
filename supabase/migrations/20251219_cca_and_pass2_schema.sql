-- ============================================================================
-- CCA (County Capability Asset) and Pass 2 Jurisdiction Card Schema
-- ============================================================================
--
-- DOCTRINE:
-- "Claude thinks. Neon remembers. Lovable orchestrates."
--
-- CCA (ref schema) = HOW to collect data
-- Pass 2 (pass2 schema) = WHAT the jurisdiction facts are
-- Pass 3 = Consumes Pass 2 blindly, NEVER references CCA
--
-- ============================================================================

-- ============================================================================
-- SCHEMA SETUP
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS pass2;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- CCA Enums
CREATE TYPE ref.automation_method AS ENUM ('api', 'scrape', 'portal', 'manual');
CREATE TYPE ref.coverage_level AS ENUM ('full', 'partial', 'insufficient');
CREATE TYPE ref.recon_confidence AS ENUM ('low', 'medium', 'high');

-- Pass 2 Enums
CREATE TYPE pass2.ternary AS ENUM ('yes', 'no', 'unknown');
CREATE TYPE pass2.knowledge_state AS ENUM ('known', 'unknown', 'blocked');
CREATE TYPE pass2.source_type AS ENUM ('ordinance', 'pdf', 'portal', 'human');
CREATE TYPE pass2.authority_scope AS ENUM ('county', 'municipal', 'fire_district', 'state');
CREATE TYPE pass2.authority_model AS ENUM ('county', 'municipal', 'mixed', 'none');
CREATE TYPE pass2.zoning_model AS ENUM ('no_zoning', 'county', 'municipal', 'mixed');
CREATE TYPE pass2.asset_class AS ENUM ('self_storage', 'rv_storage', 'trailer_yard', 'boat_storage', 'other');

-- ============================================================================
-- CCA TABLE (ref schema)
-- ============================================================================
--
-- This table stores the CCA Recon Agent output.
-- One row per county. TTL-governed refresh.
--
-- ============================================================================

CREATE TABLE ref.county_capability (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- County identification (immutable)
  county_id BIGINT NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  county_name VARCHAR(100) NOT NULL,
  county_fips VARCHAR(5),

  -- -------------------------------------------------------------------------
  -- PASS 0 CAPABILITY (Permits & Inspections - ongoing)
  -- -------------------------------------------------------------------------

  pass0_method ref.automation_method NOT NULL DEFAULT 'manual',
  pass0_source_pointer TEXT,
  pass0_coverage ref.coverage_level NOT NULL DEFAULT 'insufficient',
  pass0_notes TEXT,

  -- Pass 0 detailed capability
  pass0_vendor VARCHAR(50),           -- e.g., 'accela', 'tyler', 'municity'
  pass0_has_api BOOLEAN DEFAULT FALSE,
  pass0_has_portal BOOLEAN DEFAULT FALSE,
  pass0_inspections_linked BOOLEAN,   -- NULL = unknown
  pass0_historical_depth_years SMALLINT,

  -- -------------------------------------------------------------------------
  -- PASS 2 CAPABILITY (Jurisdiction / Static Facts - one-time or annual)
  -- -------------------------------------------------------------------------

  pass2_method ref.automation_method NOT NULL DEFAULT 'manual',
  pass2_source_pointer TEXT,
  pass2_coverage ref.coverage_level NOT NULL DEFAULT 'insufficient',
  pass2_notes TEXT,

  -- Pass 2 detailed capability
  pass2_zoning_model pass2.zoning_model,
  pass2_ordinance_format VARCHAR(20), -- 'html', 'pdf_searchable', 'pdf_scanned'
  pass2_has_gis BOOLEAN DEFAULT FALSE,
  pass2_has_online_ordinance BOOLEAN DEFAULT FALSE,
  pass2_planning_url TEXT,
  pass2_ordinance_url TEXT,
  pass2_zoning_map_url TEXT,

  -- -------------------------------------------------------------------------
  -- META
  -- -------------------------------------------------------------------------

  confidence ref.recon_confidence NOT NULL DEFAULT 'low',
  evidence_links TEXT[],

  -- TTL governance
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_months SMALLINT NOT NULL DEFAULT 12,
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (verified_at + (ttl_months || ' months')::INTERVAL) STORED,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  -- Version for optimistic locking
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for CCA
CREATE INDEX idx_cca_state ON ref.county_capability(state);
CREATE INDEX idx_cca_expires ON ref.county_capability(expires_at);
CREATE INDEX idx_cca_method_p0 ON ref.county_capability(pass0_method);
CREATE INDEX idx_cca_method_p2 ON ref.county_capability(pass2_method);

-- Comments
COMMENT ON TABLE ref.county_capability IS 'CCA Recon Agent output. One row per county. TTL-governed.';
COMMENT ON COLUMN ref.county_capability.pass0_method IS 'Best automation method for Pass 0 (permits/inspections)';
COMMENT ON COLUMN ref.county_capability.pass2_method IS 'Best automation method for Pass 2 (jurisdiction facts)';
COMMENT ON COLUMN ref.county_capability.expires_at IS 'Auto-computed from verified_at + ttl_months';

-- ============================================================================
-- PASS 2 JURISDICTION CARD TABLES
-- ============================================================================
--
-- DOCTRINE:
-- Pass 2 defines WHAT is true about a jurisdiction.
-- - Data may be known or unknown
-- - Absence of data is meaningful
-- - Pass 3 consumes this data without reinterpretation
--
-- Structure mirrors the canonical PASS2_JURISDICTION_CARD.md spec.
--
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. JURISDICTION IDENTITY
-- ---------------------------------------------------------------------------

CREATE TABLE pass2.jurisdiction_identity (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL UNIQUE REFERENCES ref.county_capability(county_id),

  -- Identity (from CCA, duplicated for denormalization)
  county_name VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  county_fips VARCHAR(5),
  asset_class pass2.asset_class NOT NULL DEFAULT 'self_storage',

  -- Authority model
  authority_model pass2.authority_model NOT NULL DEFAULT 'county',
  zoning_model pass2.zoning_model NOT NULL DEFAULT 'county',

  -- Controlling authority (with provenance)
  controlling_authority_name TEXT,
  controlling_authority_name_source pass2.source_type,
  controlling_authority_name_ref TEXT,

  controlling_authority_contact TEXT,
  controlling_authority_contact_source pass2.source_type,
  controlling_authority_contact_ref TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- B. USE VIABILITY
-- ---------------------------------------------------------------------------

CREATE TABLE pass2.use_viability (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL UNIQUE REFERENCES ref.county_capability(county_id),

  -- Storage allowed
  storage_allowed pass2.ternary NOT NULL DEFAULT 'unknown',
  storage_allowed_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  storage_allowed_source pass2.source_type,
  storage_allowed_ref TEXT,
  storage_allowed_scope pass2.authority_scope,
  storage_allowed_verified_at TIMESTAMPTZ,

  -- Fatal prohibition
  fatal_prohibition pass2.ternary NOT NULL DEFAULT 'unknown',
  fatal_prohibition_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  fatal_prohibition_description TEXT,
  fatal_prohibition_source pass2.source_type,
  fatal_prohibition_ref TEXT,

  -- Conditional use
  conditional_use_required pass2.ternary NOT NULL DEFAULT 'unknown',
  conditional_use_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  conditional_use_source pass2.source_type,
  conditional_use_ref TEXT,

  -- Discretionary approval
  discretionary_required pass2.ternary NOT NULL DEFAULT 'unknown',
  discretionary_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  discretionary_source pass2.source_type,
  discretionary_ref TEXT,

  -- Notes
  general_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- C. ZONING ENVELOPE (REQUIRED_FOR_ENVELOPE)
-- ---------------------------------------------------------------------------

CREATE TABLE pass2.zoning_envelope (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL UNIQUE REFERENCES ref.county_capability(county_id),

  -- SETBACKS (all in feet)
  setback_front NUMERIC(8,2),
  setback_front_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  setback_front_source pass2.source_type,
  setback_front_ref TEXT,
  setback_front_scope pass2.authority_scope,

  setback_side NUMERIC(8,2),
  setback_side_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  setback_side_source pass2.source_type,
  setback_side_ref TEXT,
  setback_side_scope pass2.authority_scope,

  setback_rear NUMERIC(8,2),
  setback_rear_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  setback_rear_source pass2.source_type,
  setback_rear_ref TEXT,
  setback_rear_scope pass2.authority_scope,

  -- COVERAGE / INTENSITY
  max_lot_coverage NUMERIC(5,2),      -- percentage
  max_lot_coverage_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  max_lot_coverage_source pass2.source_type,
  max_lot_coverage_ref TEXT,

  max_far NUMERIC(5,2),               -- floor area ratio
  max_far_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  max_far_source pass2.source_type,
  max_far_ref TEXT,

  min_open_space NUMERIC(5,2),        -- percentage
  min_open_space_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  min_open_space_source pass2.source_type,
  min_open_space_ref TEXT,

  max_height NUMERIC(8,2),            -- feet
  max_height_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  max_height_source pass2.source_type,
  max_height_ref TEXT,
  max_height_scope pass2.authority_scope,

  max_stories SMALLINT,
  max_stories_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  max_stories_source pass2.source_type,
  max_stories_ref TEXT,

  -- BUFFERS (all in feet)
  buffer_residential NUMERIC(8,2),
  buffer_residential_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  buffer_residential_source pass2.source_type,
  buffer_residential_ref TEXT,

  buffer_waterway NUMERIC(8,2),
  buffer_waterway_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  buffer_waterway_source pass2.source_type,
  buffer_waterway_ref TEXT,

  buffer_roadway NUMERIC(8,2),
  buffer_roadway_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  buffer_roadway_source pass2.source_type,
  buffer_roadway_ref TEXT,

  -- Envelope completeness flag
  envelope_complete BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- D. FIRE & LIFE SAFETY
-- ---------------------------------------------------------------------------

CREATE TABLE pass2.fire_life_safety (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL UNIQUE REFERENCES ref.county_capability(county_id),

  -- Fire lane
  fire_lane_required pass2.ternary NOT NULL DEFAULT 'unknown',
  fire_lane_required_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  fire_lane_required_source pass2.source_type,
  fire_lane_required_ref TEXT,

  min_fire_lane_width NUMERIC(6,2),   -- feet
  min_fire_lane_width_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  min_fire_lane_width_source pass2.source_type,
  min_fire_lane_width_ref TEXT,

  -- Hydrants
  max_hydrant_spacing NUMERIC(8,2),   -- feet
  max_hydrant_spacing_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  max_hydrant_spacing_source pass2.source_type,
  max_hydrant_spacing_ref TEXT,

  -- Fire access
  fire_dept_access_required pass2.ternary NOT NULL DEFAULT 'unknown',
  fire_dept_access_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  fire_dept_access_source pass2.source_type,
  fire_dept_access_ref TEXT,

  -- Sprinkler
  sprinkler_required pass2.ternary NOT NULL DEFAULT 'unknown',
  sprinkler_required_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  sprinkler_required_source pass2.source_type,
  sprinkler_required_ref TEXT,

  -- Fire code
  adopted_fire_code VARCHAR(50),
  adopted_fire_code_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  adopted_fire_code_source pass2.source_type,
  adopted_fire_code_ref TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- E. STORMWATER & ENVIRONMENTAL
-- ---------------------------------------------------------------------------

CREATE TABLE pass2.stormwater_environmental (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL UNIQUE REFERENCES ref.county_capability(county_id),

  -- Detention / Retention
  detention_required pass2.ternary NOT NULL DEFAULT 'unknown',
  detention_required_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  detention_required_source pass2.source_type,
  detention_required_ref TEXT,

  retention_required pass2.ternary NOT NULL DEFAULT 'unknown',
  retention_required_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  retention_required_source pass2.source_type,
  retention_required_ref TEXT,

  -- Impervious
  max_impervious NUMERIC(5,2),        -- percentage
  max_impervious_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  max_impervious_source pass2.source_type,
  max_impervious_ref TEXT,

  -- Overlays
  watershed_overlay pass2.ternary NOT NULL DEFAULT 'unknown',
  watershed_overlay_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  watershed_overlay_source pass2.source_type,
  watershed_overlay_ref TEXT,

  floodplain_overlay pass2.ternary NOT NULL DEFAULT 'unknown',
  floodplain_overlay_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  floodplain_overlay_source pass2.source_type,
  floodplain_overlay_ref TEXT,

  -- Notes
  environmental_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- F. PARKING & ACCESS
-- ---------------------------------------------------------------------------

CREATE TABLE pass2.parking_access (
  id BIGSERIAL PRIMARY KEY,
  county_id BIGINT NOT NULL UNIQUE REFERENCES ref.county_capability(county_id),

  -- Parking
  parking_required pass2.ternary NOT NULL DEFAULT 'unknown',
  parking_required_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  parking_required_source pass2.source_type,
  parking_required_ref TEXT,

  parking_ratio NUMERIC(8,4),         -- spaces per sqft or unit
  parking_ratio_unit VARCHAR(20),     -- 'per_sqft', 'per_unit'
  parking_ratio_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  parking_ratio_source pass2.source_type,
  parking_ratio_ref TEXT,

  -- Truck access
  truck_access_required pass2.ternary NOT NULL DEFAULT 'unknown',
  truck_access_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  truck_access_source pass2.source_type,
  truck_access_ref TEXT,

  -- Driveway
  min_driveway_width NUMERIC(6,2),    -- feet
  min_driveway_width_state pass2.knowledge_state NOT NULL DEFAULT 'unknown',
  min_driveway_width_source pass2.source_type,
  min_driveway_width_ref TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER trg_cca_updated_at BEFORE UPDATE ON ref.county_capability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_identity_updated_at BEFORE UPDATE ON pass2.jurisdiction_identity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_viability_updated_at BEFORE UPDATE ON pass2.use_viability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_envelope_updated_at BEFORE UPDATE ON pass2.zoning_envelope
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_fire_updated_at BEFORE UPDATE ON pass2.fire_life_safety
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_stormwater_updated_at BEFORE UPDATE ON pass2.stormwater_environmental
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_parking_updated_at BEFORE UPDATE ON pass2.parking_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ENVELOPE COMPLETENESS CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION pass2.check_envelope_completeness()
RETURNS TRIGGER AS $$
BEGIN
  -- REQUIRED_FOR_ENVELOPE: setbacks (front, side, rear), max_lot_coverage, max_height
  NEW.envelope_complete := (
    NEW.setback_front_state = 'known' AND
    NEW.setback_side_state = 'known' AND
    NEW.setback_rear_state = 'known' AND
    NEW.max_lot_coverage_state = 'known' AND
    NEW.max_height_state = 'known'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_envelope_completeness
  BEFORE INSERT OR UPDATE ON pass2.zoning_envelope
  FOR EACH ROW EXECUTE FUNCTION pass2.check_envelope_completeness();

-- ============================================================================
-- VIEWS FOR DOWNSTREAM CONSUMPTION
-- ============================================================================

-- CCA summary view (for Lovable dispatch)
CREATE OR REPLACE VIEW ref.v_cca_summary AS
SELECT
  county_id,
  state,
  county_name,
  pass0_method,
  pass0_coverage,
  pass2_method,
  pass2_coverage,
  confidence,
  verified_at,
  expires_at,
  CASE WHEN expires_at < NOW() THEN TRUE ELSE FALSE END AS is_expired,
  CASE WHEN expires_at < NOW() + INTERVAL '30 days' THEN TRUE ELSE FALSE END AS expires_soon
FROM ref.county_capability;

COMMENT ON VIEW ref.v_cca_summary IS 'CCA summary for Lovable dispatch decisions';

-- Pass 2 complete card view (for Pass 3 consumption)
CREATE OR REPLACE VIEW pass2.v_jurisdiction_card_for_pass3 AS
SELECT
  i.county_id,
  i.county_name,
  i.state,
  i.asset_class,
  i.authority_model,
  i.zoning_model,

  -- Use viability (gating)
  v.storage_allowed,
  v.fatal_prohibition,
  v.conditional_use_required,
  v.discretionary_required,

  -- Zoning envelope (REQUIRED_FOR_ENVELOPE)
  e.setback_front,
  e.setback_side,
  e.setback_rear,
  e.max_lot_coverage,
  e.max_far,
  e.min_open_space,
  e.max_height,
  e.max_stories,
  e.buffer_residential,
  e.buffer_waterway,
  e.buffer_roadway,
  e.envelope_complete,

  -- Fire & life safety
  f.fire_lane_required,
  f.min_fire_lane_width,
  f.max_hydrant_spacing,
  f.fire_dept_access_required,
  f.sprinkler_required,
  f.adopted_fire_code,

  -- Stormwater
  s.detention_required,
  s.retention_required,
  s.max_impervious,
  s.watershed_overlay,
  s.floodplain_overlay,

  -- Parking
  p.parking_required,
  p.parking_ratio,
  p.truck_access_required,
  p.min_driveway_width,

  -- Meta
  GREATEST(i.updated_at, v.updated_at, e.updated_at, f.updated_at, s.updated_at, p.updated_at) AS last_updated

FROM pass2.jurisdiction_identity i
LEFT JOIN pass2.use_viability v ON i.county_id = v.county_id
LEFT JOIN pass2.zoning_envelope e ON i.county_id = e.county_id
LEFT JOIN pass2.fire_life_safety f ON i.county_id = f.county_id
LEFT JOIN pass2.stormwater_environmental s ON i.county_id = s.county_id
LEFT JOIN pass2.parking_access p ON i.county_id = p.county_id;

COMMENT ON VIEW pass2.v_jurisdiction_card_for_pass3 IS 'Complete jurisdiction card for Pass 3 consumption. Pass 3 reads this view blindly.';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if CCA needs refresh
CREATE OR REPLACE FUNCTION ref.needs_refresh(p_county_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT expires_at INTO v_expires_at
  FROM ref.county_capability
  WHERE county_id = p_county_id;

  IF v_expires_at IS NULL THEN
    RETURN TRUE;  -- No CCA exists
  END IF;

  RETURN v_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Check if Pass 2 envelope is complete
CREATE OR REPLACE FUNCTION pass2.is_envelope_complete(p_county_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_complete BOOLEAN;
BEGIN
  SELECT envelope_complete INTO v_complete
  FROM pass2.zoning_envelope
  WHERE county_id = p_county_id;

  RETURN COALESCE(v_complete, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Check if county has fatal prohibition
CREATE OR REPLACE FUNCTION pass2.has_fatal_prohibition(p_county_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_prohibition pass2.ternary;
BEGIN
  SELECT fatal_prohibition INTO v_prohibition
  FROM pass2.use_viability
  WHERE county_id = p_county_id;

  RETURN v_prohibition = 'yes';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (adjust based on your roles)
-- ============================================================================

-- Read-only access for Pass 0
-- GRANT SELECT ON ref.county_capability TO pass0_reader;

-- Read-only access for Pass 2
-- GRANT SELECT ON ref.county_capability TO pass2_reader;
-- GRANT SELECT, INSERT, UPDATE ON pass2.jurisdiction_identity TO pass2_writer;
-- GRANT SELECT, INSERT, UPDATE ON pass2.use_viability TO pass2_writer;
-- GRANT SELECT, INSERT, UPDATE ON pass2.zoning_envelope TO pass2_writer;
-- GRANT SELECT, INSERT, UPDATE ON pass2.fire_life_safety TO pass2_writer;
-- GRANT SELECT, INSERT, UPDATE ON pass2.stormwater_environmental TO pass2_writer;
-- GRANT SELECT, INSERT, UPDATE ON pass2.parking_access TO pass2_writer;

-- Read-only access for Pass 3
-- GRANT SELECT ON pass2.v_jurisdiction_card_for_pass3 TO pass3_reader;
