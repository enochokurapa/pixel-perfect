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
    SET status = CASE WHEN COALESCE(NEW.badge_returned, false) THEN 'available' ELSE 'unreturned' END
    WHERE badge_number = OLD.badge_number
      AND (branch_id = OLD.branch_id OR (branch_id IS NULL AND NEW.branch_id IS NULL))
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

DROP TRIGGER IF EXISTS trg_enforce_visit_badge_rules ON public.visits;
CREATE TRIGGER trg_enforce_visit_badge_rules
BEFORE INSERT OR UPDATE OF status, badge_number, branch_id ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.enforce_visit_badge_rules();

DROP TRIGGER IF EXISTS trg_sync_badge_status_from_visit ON public.visits;
CREATE TRIGGER trg_sync_badge_status_from_visit
AFTER INSERT OR UPDATE OF status, badge_number, branch_id, badge_returned ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.sync_badge_status_from_visit();

REVOKE EXECUTE ON FUNCTION public.enforce_visit_badge_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_badge_status_from_visit() FROM PUBLIC, anon, authenticated;