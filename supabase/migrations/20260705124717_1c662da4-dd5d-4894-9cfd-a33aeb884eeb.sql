-- Allow signed-in users and backend roles to call staff/role helper functions used by access rules.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_branch(uuid, uuid) TO authenticated, service_role;

-- Replace the vehicle audit policies so they no longer depend on a helper that can block normal signed-in users.
DROP POLICY IF EXISTS "Staff can insert vehicle audit" ON public.visit_vehicle_audit;
DROP POLICY IF EXISTS "Staff can view vehicle audit" ON public.visit_vehicle_audit;
CREATE POLICY "Authenticated users can insert vehicle audit"
ON public.visit_vehicle_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view vehicle audit"
ON public.visit_vehicle_audit
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Normalize existing badge statuses from active visits before enforcing stronger rules.
UPDATE public.badges b
SET status = 'issued'
FROM public.visits v
WHERE v.status = 'checked_in'
  AND v.badge_number IS NOT NULL
  AND v.badge_number = b.badge_number
  AND (v.branch_id = b.branch_id OR (v.branch_id IS NULL AND b.branch_id IS NULL));

UPDATE public.badges b
SET status = 'available'
WHERE b.status = 'issued'
  AND NOT EXISTS (
    SELECT 1
    FROM public.visits v
    WHERE v.status = 'checked_in'
      AND v.badge_number = b.badge_number
      AND (v.branch_id = b.branch_id OR (v.branch_id IS NULL AND b.branch_id IS NULL))
  );

-- Prevent a badge from being active on more than one visitor in the same branch.
CREATE UNIQUE INDEX IF NOT EXISTS visits_one_active_badge_per_branch
ON public.visits (branch_id, badge_number)
WHERE status = 'checked_in' AND badge_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_visit_badge_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_badge_status text;
BEGIN
  IF NEW.status = 'checked_in' THEN
    IF NEW.badge_number IS NULL OR btrim(NEW.badge_number) = '' THEN
      RAISE EXCEPTION 'A badge is required before a visitor can be checked in.';
    END IF;

    SELECT status INTO v_badge_status
    FROM public.badges
    WHERE badge_number = NEW.badge_number
      AND (branch_id = NEW.branch_id OR (branch_id IS NULL AND NEW.branch_id IS NULL))
    LIMIT 1;

    IF v_badge_status IS NULL THEN
      RAISE EXCEPTION 'The selected badge does not exist for this branch.';
    END IF;

    IF TG_OP = 'INSERT' OR OLD.badge_number IS DISTINCT FROM NEW.badge_number OR OLD.status IS DISTINCT FROM NEW.status THEN
      IF v_badge_status <> 'available' THEN
        RAISE EXCEPTION 'Badge % is already in use and cannot be issued to another visitor until it is returned.', NEW.badge_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_visit_badge_rules ON public.visits;
CREATE TRIGGER trg_enforce_visit_badge_rules
BEFORE INSERT OR UPDATE OF status, badge_number, branch_id ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.enforce_visit_badge_rules();

CREATE OR REPLACE FUNCTION public.sync_badge_status_from_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'checked_in' AND NEW.badge_number IS NOT NULL THEN
      UPDATE public.badges
      SET status = 'issued'
      WHERE badge_number = NEW.badge_number
        AND (branch_id = NEW.branch_id OR (branch_id IS NULL AND NEW.branch_id IS NULL));
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'checked_in'
     AND OLD.badge_number IS NOT NULL
     AND (NEW.status IS DISTINCT FROM 'checked_in' OR NEW.badge_number IS DISTINCT FROM OLD.badge_number) THEN
    UPDATE public.badges
    SET status = 'available'
    WHERE badge_number = OLD.badge_number
      AND (branch_id = OLD.branch_id OR (branch_id IS NULL AND OLD.branch_id IS NULL))
      AND NOT EXISTS (
        SELECT 1
        FROM public.visits v
        WHERE v.id <> NEW.id
          AND v.status = 'checked_in'
          AND v.badge_number = OLD.badge_number
          AND (v.branch_id = OLD.branch_id OR (v.branch_id IS NULL AND OLD.branch_id IS NULL))
      );
  END IF;

  IF NEW.status = 'checked_in' AND NEW.badge_number IS NOT NULL THEN
    UPDATE public.badges
    SET status = 'issued'
    WHERE badge_number = NEW.badge_number
      AND (branch_id = NEW.branch_id OR (branch_id IS NULL AND NEW.branch_id IS NULL));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_badge_status_from_visit ON public.visits;
CREATE TRIGGER trg_sync_badge_status_from_visit
AFTER INSERT OR UPDATE OF status, badge_number, branch_id ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.sync_badge_status_from_visit();