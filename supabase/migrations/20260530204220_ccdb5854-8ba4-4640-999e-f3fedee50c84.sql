
-- 1. Branches: site_type
DO $$ BEGIN
  CREATE TYPE public.site_type AS ENUM ('corporate', 'school');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS site_type public.site_type NOT NULL DEFAULT 'corporate';

-- 2. Extend app_role enum
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'school_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gate_officer'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guardian'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manage_students'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'check_in_student'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'approve_pickup'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'view_student_reports'; EXCEPTION WHEN others THEN NULL; END $$;

-- 3. Extend notifications type (it's text-like enum; we use text-cast safely)
DO $$ BEGIN
  PERFORM 1 FROM pg_type WHERE typname = 'notification_type';
  IF FOUND THEN
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'student_arrival'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pickup_approval_request'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pickup_approved'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pickup_rejected'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- 4. Enums for new tables
DO $$ BEGIN
  CREATE TYPE public.check_in_method AS ENUM ('van', 'parent', 'walking', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pickup_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. students
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code text,
  full_name text NOT NULL,
  class text,
  photo_url text,
  branch_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage students" ON public.students FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. guardians
CREATE TABLE IF NOT EXISTS public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage guardians" ON public.guardians FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_guardians_updated BEFORE UPDATE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. student_guardians link
CREATE TABLE IF NOT EXISTS public.student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  guardian_id uuid NOT NULL,
  relation text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, guardian_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_guardians TO authenticated;
GRANT ALL ON public.student_guardians TO service_role;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage student_guardians" ON public.student_guardians FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 8. attendance_logs
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  branch_id uuid,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_in_method public.check_in_method NOT NULL DEFAULT 'parent',
  checked_in_by uuid,
  check_out_at timestamptz,
  checked_out_by uuid,
  pickup_request_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_logs TO authenticated;
GRANT ALL ON public.attendance_logs TO service_role;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage attendance" ON public.attendance_logs FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 9. pickup_requests
CREATE TABLE IF NOT EXISTS public.pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  branch_id uuid,
  pickup_person_name text NOT NULL,
  pickup_person_phone text,
  vehicle_plate text,
  pickup_person_photo_url text,
  status public.pickup_status NOT NULL DEFAULT 'pending',
  guardian_id uuid,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_requests TO authenticated;
GRANT ALL ON public.pickup_requests TO service_role;
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage pickup_requests" ON public.pickup_requests FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_pickup_requests_updated BEFORE UPDATE ON public.pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. pickup_response_tokens (mirrors visit_response_tokens)
CREATE TABLE IF NOT EXISTS public.pickup_response_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_request_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  response text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pickup_response_tokens TO anon;
GRANT UPDATE ON public.pickup_response_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_response_tokens TO authenticated;
GRANT ALL ON public.pickup_response_tokens TO service_role;
ALTER TABLE public.pickup_response_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read pickup tokens" ON public.pickup_response_tokens
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon submit pickup response" ON public.pickup_response_tokens
  FOR UPDATE TO anon USING (used_at IS NULL)
  WITH CHECK (used_at IS NOT NULL AND response = ANY (ARRAY['approved','rejected']));
CREATE POLICY "Auth manage pickup tokens" ON public.pickup_response_tokens
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 11. Storage bucket for student-photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read student photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-photos');
CREATE POLICY "Auth upload student photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-photos');
CREATE POLICY "Auth update student photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'student-photos');

-- 12. Indices
CREATE INDEX IF NOT EXISTS idx_students_branch ON public.students(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checkin ON public.attendance_logs(check_in_at);
CREATE INDEX IF NOT EXISTS idx_pickup_student ON public.pickup_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_pickup_status ON public.pickup_requests(status);
CREATE INDEX IF NOT EXISTS idx_pickup_token ON public.pickup_response_tokens(token);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON public.student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian ON public.student_guardians(guardian_id);
