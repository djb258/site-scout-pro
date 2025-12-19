-- Add composite index for efficient jurisdiction card draft lookups
-- Covers the primary query pattern: filter by state, county, status, order by collected_at
CREATE INDEX IF NOT EXISTS idx_jc_drafts_lookup 
ON public.jurisdiction_card_drafts(state_code, county_id, status, collected_at DESC);

-- Add index on card_payload county_name for temporary fallback lookup
-- TODO: This is a TEMPORARY SHIM - county_name should become a first-class column
-- or this path should be killed in the next pass (violates authority-first doctrine)
CREATE INDEX IF NOT EXISTS idx_jc_drafts_county_name 
ON public.jurisdiction_card_drafts((card_payload->>'county_name'));

COMMENT ON INDEX idx_jc_drafts_county_name IS 
'TEMPORARY: String matching on card_payload.county_name is fragile. 
TODO: Add county_name as first-class column or remove this fallback path.';