DROP POLICY IF EXISTS "Anon can submit response" ON public.visit_response_tokens;
CREATE POLICY "Anon can submit response" ON public.visit_response_tokens
  FOR UPDATE TO anon
  USING (used_at IS NULL)
  WITH CHECK (used_at IS NOT NULL AND response IN ('confirmed','rejected'));