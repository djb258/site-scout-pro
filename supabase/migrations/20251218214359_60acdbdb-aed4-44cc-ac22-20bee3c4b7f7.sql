-- Add fields to track data completeness and Pass 1.5 promotion
ALTER TABLE public.competitor_facilities 
ADD COLUMN data_completeness NUMERIC DEFAULT 0,
ADD COLUMN needs_call_verification BOOLEAN DEFAULT false,
ADD COLUMN promoted_to_pass15 BOOLEAN DEFAULT false,
ADD COLUMN pass15_queue_id UUID,
ADD COLUMN verified_by_call BOOLEAN DEFAULT false,
ADD COLUMN call_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN missing_fields TEXT[];