
-- Visit photo columns
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS face_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS id_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS id_photo_type TEXT,
  ADD COLUMN IF NOT EXISTS photos_captured_at TIMESTAMPTZ;

-- Activity log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_department TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_branch ON public.activity_log(branch_id, created_at DESC);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert own activity" ON public.activity_log;
CREATE POLICY "Authenticated can insert own activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "Admin/auditors view activity" ON public.activity_log;
CREATE POLICY "Admin/auditors view activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'view_audit_log')
    OR public.has_role(auth.uid(), 'view_reports')
  );

-- Storage policies for visitor-photos
DROP POLICY IF EXISTS "Staff view visitor-photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload visitor-photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff update visitor-photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete visitor-photos" ON storage.objects;

CREATE POLICY "Staff view visitor-photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'visitor-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload visitor-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'visitor-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update visitor-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'visitor-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "Admin delete visitor-photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'visitor-photos' AND public.has_role(auth.uid(), 'admin'));
