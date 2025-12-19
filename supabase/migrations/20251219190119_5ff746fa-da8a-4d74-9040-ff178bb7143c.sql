-- ============================================================================
-- MANDATORY FOLLOW-UP #1: Promote county_name to first-class column
-- ============================================================================
-- Removes fragile card_payload->>'county_name' string matching
-- Establishes structural column for authority-first doctrine compliance

-- Step 1: Add county_name as first-class column
ALTER TABLE public.jurisdiction_card_drafts 
ADD COLUMN IF NOT EXISTS county_name TEXT;

-- Step 2: Backfill from existing card_payload
UPDATE public.jurisdiction_card_drafts 
SET county_name = card_payload->>'county_name'
WHERE county_name IS NULL AND card_payload->>'county_name' IS NOT NULL;

-- Step 3: Set default for new rows (allow NULL for migration safety)
ALTER TABLE public.jurisdiction_card_drafts 
ALTER COLUMN county_name SET DEFAULT 'Unknown';

-- Step 4: Create index on STRUCTURAL column (replaces the JSONB index)
CREATE INDEX IF NOT EXISTS idx_jc_drafts_county_name_structural
ON public.jurisdiction_card_drafts(state_code, county_name);

-- Step 5: Drop the temporary JSONB index (kill the shim)
DROP INDEX IF EXISTS idx_jc_drafts_county_name;

-- Step 6: Add documentation
COMMENT ON COLUMN public.jurisdiction_card_drafts.county_name IS 
'STRUCTURAL: First-class county name. Do NOT read from card_payload for identity lookup. CI enforced.';