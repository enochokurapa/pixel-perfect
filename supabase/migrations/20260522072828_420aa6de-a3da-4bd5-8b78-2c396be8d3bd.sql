
-- Notifications
CREATE TYPE notification_type AS ENUM ('visit_arrived','visit_pre_registered','visit_checked_out','visit_approved','visit_rejected','overstay');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  visit_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Staff insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (recipient_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add rejection reason to visits
ALTER TABLE public.visits ADD COLUMN rejection_reason text;

-- Trigger to notify host on visit lifecycle
CREATE OR REPLACE FUNCTION public.notify_host_on_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visitor_name text;
BEGIN
  IF NEW.host_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_visitor_name FROM public.visitors WHERE id = NEW.visitor_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.pre_registered THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, visit_id)
      VALUES (NEW.host_id, 'visit_pre_registered',
              'New pre-registered visit',
              format('%s is scheduled to visit you. Approval required.', coalesce(v_visitor_name,'A visitor')),
              NEW.id);
    ELSIF NEW.status = 'checked_in' THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, visit_id)
      VALUES (NEW.host_id, 'visit_arrived',
              'Your visitor has arrived',
              format('%s checked in at reception.', coalesce(v_visitor_name,'A visitor')),
              NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'checked_in' THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, visit_id)
      VALUES (NEW.host_id, 'visit_arrived',
              'Your visitor has arrived',
              format('%s checked in at reception.', coalesce(v_visitor_name,'A visitor')),
              NEW.id);
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'checked_out' THEN
      INSERT INTO public.notifications (recipient_id, type, title, message, visit_id)
      VALUES (NEW.host_id, 'visit_checked_out',
              'Visitor checked out',
              format('%s has left the premises.', coalesce(v_visitor_name,'Your visitor')),
              NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_host_on_visit
AFTER INSERT OR UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.notify_host_on_visit();

-- Add updated_at trigger on visits and visitors (idempotent re-create)
DROP TRIGGER IF EXISTS trg_visits_set_updated_at ON public.visits;
CREATE TRIGGER trg_visits_set_updated_at BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_visitors_set_updated_at ON public.visitors;
CREATE TRIGGER trg_visitors_set_updated_at BEFORE UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to create profile on new auth user (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
