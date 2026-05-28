
-- Add activity-style roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'register_guest';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pre_register_guest';

-- Active/inactive flag for staff
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
