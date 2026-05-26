-- 1. Add 'delivery' to visit_type enum
ALTER TYPE visit_type ADD VALUE IF NOT EXISTS 'delivery';

-- 2. Add 'overstay' and 'visit_response' to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'overstay';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'visit_response';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'staff_credentials';

-- 3. Organization settings (single row)
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name text NOT NULL DEFAULT 'Our Office',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage org settings" ON public.organization_settings
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
INSERT INTO public.organization_settings (office_name) 
  SELECT 'Our Office' WHERE NOT EXISTS (SELECT 1 FROM public.organization_settings);

-- 4. Add branch_id to visits for branch-scoped overstay alerts; track overstay notification + extensions
ALTER TABLE public.visits 
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS overstay_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stay_extended_count integer NOT NULL DEFAULT 0;

-- 5. Visit response tokens for pre-register email confirm/reject
CREATE TABLE IF NOT EXISTS public.visit_response_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  response text,
  reason text,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_response_tokens TO authenticated;
GRANT SELECT, UPDATE ON public.visit_response_tokens TO anon;
GRANT ALL ON public.visit_response_tokens TO service_role;
ALTER TABLE public.visit_response_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can read+update token rows" ON public.visit_response_tokens
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can submit response" ON public.visit_response_tokens
  FOR UPDATE TO anon USING (used_at IS NULL) WITH CHECK (true);
CREATE POLICY "Auth manage tokens" ON public.visit_response_tokens
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Overstay scanner function
CREATE OR REPLACE FUNCTION public.scan_overstays()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  v_visitor_name text;
BEGIN
  FOR v IN
    SELECT id, host_id, branch_id, visitor_id
    FROM public.visits
    WHERE status = 'checked_in'
      AND check_in_at IS NOT NULL
      AND overstay_notified_at IS NULL
      AND (check_in_at + (expected_duration_minutes || ' minutes')::interval) < now()
  LOOP
    SELECT full_name INTO v_visitor_name FROM public.visitors WHERE id = v.visitor_id;
    -- Notify all staff in the same branch (or all staff if no branch)
    INSERT INTO public.notifications (recipient_id, type, title, message, visit_id)
    SELECT p.id, 'overstay',
           'Visitor overstay alert',
           format('%s has exceeded their expected visit time.', coalesce(v_visitor_name,'A visitor')),
           v.id
    FROM public.profiles p
    WHERE (v.branch_id IS NULL OR p.branch_id = v.branch_id OR p.branch_id IS NULL);
    
    UPDATE public.visits SET overstay_notified_at = now() WHERE id = v.id;
  END LOOP;
END;
$$;

-- 7. Schedule overstay scan every minute via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('scan-overstays');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('scan-overstays', '* * * * *', $$SELECT public.scan_overstays()$$);