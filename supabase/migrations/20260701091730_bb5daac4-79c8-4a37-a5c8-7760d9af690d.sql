
REVOKE EXECUTE ON FUNCTION public.log_visit_vehicle_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_visit_vehicle_change() TO service_role;
