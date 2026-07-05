REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.enforce_visit_badge_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_badge_status_from_visit() FROM PUBLIC, anon, authenticated;