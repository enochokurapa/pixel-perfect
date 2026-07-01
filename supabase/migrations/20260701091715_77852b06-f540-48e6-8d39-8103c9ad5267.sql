
CREATE TABLE public.visit_vehicle_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  old_plate TEXT,
  new_plate TEXT,
  old_vehicle_type TEXT,
  new_vehicle_type TEXT,
  change_kind TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vva_visit ON public.visit_vehicle_audit(visit_id, created_at DESC);

GRANT SELECT, INSERT ON public.visit_vehicle_audit TO authenticated;
GRANT ALL ON public.visit_vehicle_audit TO service_role;

ALTER TABLE public.visit_vehicle_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view vehicle audit"
ON public.visit_vehicle_audit FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert vehicle audit"
ON public.visit_vehicle_audit FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_visit_vehicle_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vehicle_plate IS NOT NULL OR NEW.vehicle_type IS NOT NULL THEN
      INSERT INTO public.visit_vehicle_audit(visit_id, old_plate, new_plate, old_vehicle_type, new_vehicle_type, change_kind, changed_by)
      VALUES (NEW.id, NULL, NEW.vehicle_plate, NULL, NEW.vehicle_type, 'created', auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (COALESCE(OLD.vehicle_plate,'') IS DISTINCT FROM COALESCE(NEW.vehicle_plate,''))
       OR (COALESCE(OLD.vehicle_type,'') IS DISTINCT FROM COALESCE(NEW.vehicle_type,'')) THEN
      IF (OLD.vehicle_plate IS NULL AND OLD.vehicle_type IS NULL) THEN
        v_kind := 'created';
      ELSIF (NEW.vehicle_plate IS NULL AND NEW.vehicle_type IS NULL) THEN
        v_kind := 'cleared';
      ELSE
        v_kind := 'updated';
      END IF;
      INSERT INTO public.visit_vehicle_audit(visit_id, old_plate, new_plate, old_vehicle_type, new_vehicle_type, change_kind, changed_by)
      VALUES (NEW.id, OLD.vehicle_plate, NEW.vehicle_plate, OLD.vehicle_type, NEW.vehicle_type, v_kind, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_visit_vehicle_change ON public.visits;
CREATE TRIGGER trg_log_visit_vehicle_change
AFTER INSERT OR UPDATE OF vehicle_plate, vehicle_type ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.log_visit_vehicle_change();
