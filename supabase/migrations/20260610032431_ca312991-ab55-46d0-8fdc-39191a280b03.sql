REVOKE EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) TO service_role;