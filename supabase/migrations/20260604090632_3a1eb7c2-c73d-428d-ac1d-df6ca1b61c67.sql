
CREATE TABLE IF NOT EXISTS public.user_branch_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branch_roles TO authenticated;
GRANT ALL ON public.user_branch_roles TO service_role;

ALTER TABLE public.user_branch_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage user_branch_roles"
ON public.user_branch_roles FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_ubr_user ON public.user_branch_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_ubr_branch ON public.user_branch_roles(branch_id);

CREATE OR REPLACE FUNCTION public.user_in_branch(_user uuid, _branch uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_branch_roles
    WHERE user_id = _user AND branch_id = _branch
  );
$$;

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS kiosk_self_registered boolean NOT NULL DEFAULT false;
