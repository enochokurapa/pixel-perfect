GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_assets TO authenticated;
GRANT ALL ON public.visit_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blacklist TO authenticated;
GRANT ALL ON public.blacklist TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branch_roles TO authenticated;
GRANT ALL ON public.user_branch_roles TO service_role;

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_badges_branch_id ON public.badges(branch_id);

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS host_name text;

CREATE INDEX IF NOT EXISTS idx_visits_host_name ON public.visits(host_name);

UPDATE public.visits v
SET host_name = p.full_name
FROM public.profiles p
WHERE v.host_id = p.id
  AND v.host_name IS NULL;