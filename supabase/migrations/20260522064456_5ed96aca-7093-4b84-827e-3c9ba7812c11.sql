
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'receptionist', 'host');
CREATE TYPE public.visit_type AS ENUM ('supplier', 'contractor', 'guest');
CREATE TYPE public.visit_mode AS ENUM ('walk_in', 'drive_in');
CREATE TYPE public.visit_status AS ENUM ('pending', 'checked_in', 'checked_out', 'overstayed');
CREATE TYPE public.approval_status AS ENUM ('not_required', 'pending', 'approved', 'not_approved', 'confirmed');
CREATE TYPE public.badge_status AS ENUM ('available', 'issued', 'unreturned', 'retired');
CREATE TYPE public.asset_kind AS ENUM ('laptop', 'device', 'other');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- Auto-create profile + default host role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'host');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Visitors
CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  company TEXT,
  id_type TEXT,
  id_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_number TEXT NOT NULL UNIQUE,
  status public.badge_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Visits
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  host_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visit_type public.visit_type NOT NULL DEFAULT 'guest',
  visit_mode public.visit_mode NOT NULL DEFAULT 'walk_in',
  purpose TEXT NOT NULL,
  company TEXT,
  work_description TEXT,
  badge_number TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  status public.visit_status NOT NULL DEFAULT 'pending',
  approval public.approval_status NOT NULL DEFAULT 'not_required',
  expected_duration_minutes INT NOT NULL DEFAULT 180,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  feedback TEXT,
  pre_registered BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_visits_status ON public.visits(status);
CREATE INDEX idx_visits_host ON public.visits(host_id);
CREATE INDEX idx_visits_visitor ON public.visits(visitor_id);
CREATE INDEX idx_visits_created_at ON public.visits(created_at DESC);

-- Visit assets
CREATE TABLE public.visit_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  kind public.asset_kind NOT NULL DEFAULT 'device',
  brand TEXT,
  serial TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visit_assets ENABLE ROW LEVEL SECURITY;

-- Blacklist
CREATE TABLE public.blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_blacklist_visitor ON public.blacklist(visitor_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER visitors_updated BEFORE UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER visits_updated BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- RLS POLICIES
-- =====================

-- profiles: any staff can view (for host selection); user updates self; admin manages all
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT
  TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin manages profiles" ON public.profiles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles: users see own; admin manages all
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manages roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- visitors: staff view/insert/update; admin delete
CREATE POLICY "Staff view visitors" ON public.visitors FOR SELECT
  TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Reception/admin insert visitors" ON public.visitors FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Reception/admin update visitors" ON public.visitors FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Admin delete visitors" ON public.visitors FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- badges
CREATE POLICY "Staff view badges" ON public.badges FOR SELECT
  TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin manage badges" ON public.badges FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- visits: staff view (host scoped); reception/admin manage; host updates own (approval, feedback)
CREATE POLICY "Staff view visits" ON public.visits FOR SELECT
  TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'receptionist')
    OR host_id = auth.uid()
  );
CREATE POLICY "Reception/admin insert visits" ON public.visits FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'admin')
    OR host_id = auth.uid()
  );
CREATE POLICY "Reception/admin/host update visits" ON public.visits FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(),'receptionist')
    OR public.has_role(auth.uid(),'admin')
    OR host_id = auth.uid()
  );
CREATE POLICY "Admin delete visits" ON public.visits FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- visit_assets
CREATE POLICY "Staff view assets" ON public.visit_assets FOR SELECT
  TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Reception/admin manage assets" ON public.visit_assets FOR ALL
  TO authenticated USING (
    public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'admin')
  );

-- blacklist
CREATE POLICY "Staff view blacklist" ON public.blacklist FOR SELECT
  TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Host/admin insert blacklist" ON public.blacklist FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Admin manage blacklist" ON public.blacklist FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete blacklist" ON public.blacklist FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(),'admin'));
