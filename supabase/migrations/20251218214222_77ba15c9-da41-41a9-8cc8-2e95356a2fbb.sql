-- Add price per sqft and unit counts by size to track market preferences
ALTER TABLE public.competitor_facilities 
ADD COLUMN price_per_sqft NUMERIC,
ADD COLUMN count_5x5 INTEGER,
ADD COLUMN count_5x10 INTEGER,
ADD COLUMN count_10x10 INTEGER,
ADD COLUMN count_10x15 INTEGER,
ADD COLUMN count_10x20 INTEGER,
ADD COLUMN count_10x30 INTEGER,
ADD COLUMN count_10x10_cc INTEGER,
ADD COLUMN count_10x15_cc INTEGER,
ADD COLUMN count_10x20_cc INTEGER,
ADD COLUMN count_rv_boat INTEGER,
ADD COLUMN dominant_unit_size TEXT;