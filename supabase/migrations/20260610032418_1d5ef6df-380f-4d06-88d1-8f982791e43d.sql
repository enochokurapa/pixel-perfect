REVOKE EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) TO authenticated, service_role;