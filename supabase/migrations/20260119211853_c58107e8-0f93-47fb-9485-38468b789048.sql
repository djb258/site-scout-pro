-- Allow deleting sovereign_ids
CREATE POLICY "Anyone can delete sovereign_ids" 
ON public.sovereign_ids 
FOR DELETE 
USING (true);

-- Allow deleting sovereign_id_zips
CREATE POLICY "Anyone can delete sovereign_id_zips" 
ON public.sovereign_id_zips 
FOR DELETE 
USING (true);

-- Allow deleting sovereign_id_counties
CREATE POLICY "Anyone can delete sovereign_id_counties" 
ON public.sovereign_id_counties 
FOR DELETE 
USING (true);