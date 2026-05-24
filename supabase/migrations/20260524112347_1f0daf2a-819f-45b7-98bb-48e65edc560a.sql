
-- Add 'security' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'security';

COMMIT;

-- Visitors: allow security to insert/update
DROP POLICY IF EXISTS "Reception/admin insert visitors" ON public.visitors;
CREATE POLICY "Reception/security/admin insert visitors" ON public.visitors
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Reception/admin update visitors" ON public.visitors;
CREATE POLICY "Reception/security/admin update visitors" ON public.visitors
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'admin'));

-- Visits: allow security to insert/update
DROP POLICY IF EXISTS "Reception/admin insert visits" ON public.visits;
CREATE POLICY "Reception/security/admin insert visits" ON public.visits
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'admin') OR host_id = auth.uid());

DROP POLICY IF EXISTS "Reception/admin/host update visits" ON public.visits;
CREATE POLICY "Reception/security/admin/host update visits" ON public.visits
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'admin') OR host_id = auth.uid());

DROP POLICY IF EXISTS "Staff view visits" ON public.visits;
CREATE POLICY "Staff view visits" ON public.visits
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR host_id = auth.uid());

-- Visit assets: allow security
DROP POLICY IF EXISTS "Reception/admin manage assets" ON public.visit_assets;
CREATE POLICY "Reception/security/admin manage assets" ON public.visit_assets
FOR ALL TO authenticated
USING (has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'admin'))
WITH CHECK (has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'admin'));

-- Badges: allow security to manage too
DROP POLICY IF EXISTS "Admin manage badges" ON public.badges;
CREATE POLICY "Admin/security manage badges" ON public.badges
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'receptionist'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'security') OR has_role(auth.uid(),'receptionist'));
