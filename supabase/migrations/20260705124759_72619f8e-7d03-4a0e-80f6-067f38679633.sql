DROP POLICY IF EXISTS "Admin/auditors view activity" ON public.activity_log;
CREATE POLICY "Admin/auditors view activity"
ON public.activity_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'view_audit_log', 'view_reports')
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_branch_roles ubr
    WHERE ubr.user_id = auth.uid()
      AND ubr.role IN ('admin', 'view_audit_log', 'view_reports')
      AND (activity_log.branch_id IS NULL OR activity_log.branch_id = ubr.branch_id)
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) FROM authenticated;