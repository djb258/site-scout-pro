-- Create sovereign_ids table (immutable market mandates)
CREATE TABLE sovereign_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sva_id TEXT NOT NULL UNIQUE,
  asset_type TEXT NOT NULL,
  anchor_zip TEXT NOT NULL,
  anchor_city TEXT NOT NULL,
  anchor_state TEXT NOT NULL,
  anchor_county TEXT NOT NULL,
  anchor_fips TEXT NOT NULL,
  anchor_lat NUMERIC NOT NULL,
  anchor_lng NUMERIC NOT NULL,
  radius_miles INTEGER NOT NULL,
  zip_count_in_scope INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_asset_type CHECK (asset_type IN ('self-storage', 'rv-storage', 'boat-storage', 'truck-tractor', 'tow-impound')),
  CONSTRAINT valid_radius CHECK (radius_miles IN (25, 50, 75, 100, 120)),
  CONSTRAINT valid_zip_format CHECK (anchor_zip ~ '^\d{5}$')
);

-- Create sovereign_id_zips table (ZIPs in scope for each SVA)
CREATE TABLE sovereign_id_zips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sva_id TEXT NOT NULL REFERENCES sovereign_ids(sva_id) ON DELETE CASCADE,
  zip TEXT NOT NULL,
  distance_miles NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_sovereign_ids_sva_id ON sovereign_ids(sva_id);
CREATE INDEX idx_sovereign_ids_anchor_zip ON sovereign_ids(anchor_zip);
CREATE INDEX idx_sovereign_ids_asset_type ON sovereign_ids(asset_type);
CREATE INDEX idx_sovereign_ids_created_at ON sovereign_ids(created_at DESC);
CREATE INDEX idx_sovereign_id_zips_sva_id ON sovereign_id_zips(sva_id);
CREATE INDEX idx_sovereign_id_zips_zip ON sovereign_id_zips(zip);

-- Enable RLS
ALTER TABLE sovereign_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_id_zips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sovereign_ids (read-only after creation - no UPDATE/DELETE)
CREATE POLICY "Anyone can read sovereign_ids" 
  ON sovereign_ids FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert sovereign_ids" 
  ON sovereign_ids FOR INSERT 
  WITH CHECK (true);

-- RLS Policies for sovereign_id_zips (read-only after creation)
CREATE POLICY "Anyone can read sovereign_id_zips" 
  ON sovereign_id_zips FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert sovereign_id_zips" 
  ON sovereign_id_zips FOR INSERT 
  WITH CHECK (true);