DROP POLICY IF EXISTS "Admin delete visitor-photos" ON storage.objects;
CREATE POLICY "Admin delete visitor-photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'visitor-photos'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);