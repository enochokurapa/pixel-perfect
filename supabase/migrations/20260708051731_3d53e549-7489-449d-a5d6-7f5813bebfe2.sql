CREATE OR REPLACE FUNCTION public.checkout_visit(
  _visit_id uuid,
  _badge_returned boolean,
  _assets_verified boolean,
  _checkout_notes text DEFAULT NULL
)
RETURNS TABLE(ok boolean, checked_out_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit record;
  v_allowed boolean;
  v_checked_out_at timestamptz := now();
  v_actor record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to check out visitors.';
  END IF;

  SELECT id, status, badge_number, branch_id
    INTO v_visit
  FROM public.visits
  WHERE id = _visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found.';
  END IF;

  IF v_visit.status <> 'checked_in' THEN
    RAISE EXCEPTION 'Only checked-in visitors can be checked out.';
  END IF;

  IF v_visit.badge_number IS NOT NULL AND NOT coalesce(_badge_returned, false) THEN
    RAISE EXCEPTION 'Please confirm the badge was returned before checking out.';
  END IF;

  IF NOT coalesce(_assets_verified, false) THEN
    RAISE EXCEPTION 'Please confirm assets were verified before checking out.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'checkout_visitor', 'manage_badges')
  ) OR EXISTS (
    SELECT 1
    FROM public.user_branch_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'checkout_visitor', 'manage_badges')
      AND (v_visit.branch_id IS NULL OR branch_id = v_visit.branch_id)
  )
  INTO v_allowed;

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'You do not have permission to check out visitors.';
  END IF;

  UPDATE public.visits
  SET status = 'checked_out',
      check_out_at = v_checked_out_at,
      badge_returned = coalesce(_badge_returned, false),
      assets_verified = coalesce(_assets_verified, false),
      checkout_notes = nullif(btrim(coalesce(_checkout_notes, '')), '')
  WHERE id = _visit_id
    AND status = 'checked_in';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This visitor has already been checked out or is no longer checked in.';
  END IF;

  IF v_visit.badge_number IS NOT NULL THEN
    UPDATE public.badges
    SET status = 'available'
    WHERE badge_number = v_visit.badge_number
      AND (branch_id = v_visit.branch_id OR (branch_id IS NULL AND v_visit.branch_id IS NULL));
  END IF;

  SELECT full_name, department, email
    INTO v_actor
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.activity_log (
    actor_id,
    actor_name,
    actor_department,
    action,
    entity_type,
    entity_id,
    branch_id,
    details
  ) VALUES (
    auth.uid(),
    coalesce(v_actor.full_name, v_actor.email),
    v_actor.department,
    'visit.check_out',
    'visit',
    v_visit.id,
    v_visit.branch_id,
    jsonb_build_object(
      'badge_number', v_visit.badge_number,
      'badge_returned', coalesce(_badge_returned, false),
      'assets_verified', coalesce(_assets_verified, false)
    )
  );

  RETURN QUERY SELECT true, v_checked_out_at;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_visit(uuid, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_visit(uuid, boolean, boolean, text) TO authenticated, service_role;