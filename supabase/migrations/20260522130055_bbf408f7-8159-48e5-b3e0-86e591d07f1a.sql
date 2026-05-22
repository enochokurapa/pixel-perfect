
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS id_scan_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('id-scans', 'id-scans', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff view id-scans"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'id-scans' AND public.is_staff(auth.uid()));

CREATE POLICY "Reception/admin upload id-scans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'id-scans'
  AND (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Reception/admin update id-scans"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'id-scans'
  AND (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admin delete id-scans"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'id-scans' AND public.has_role(auth.uid(), 'admin'));
