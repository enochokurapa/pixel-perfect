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

REVOKE EXECUTE ON FUNCTION public.sync_badge_status_from_visit() FROM PUBLIC, anon, authenticated;