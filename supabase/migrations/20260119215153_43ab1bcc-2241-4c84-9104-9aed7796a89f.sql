-- Add sqft_per_person to sovereign_ids table (default 6)
ALTER TABLE sovereign_ids 
ADD COLUMN sqft_per_person numeric NOT NULL DEFAULT 6;

-- Add demand_sqft to sovereign_id_zips table
ALTER TABLE sovereign_id_zips 
ADD COLUMN demand_sqft numeric DEFAULT NULL;