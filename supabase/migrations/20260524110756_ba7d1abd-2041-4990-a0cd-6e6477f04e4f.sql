-- 1. Wipe app data
TRUNCATE
  public.visit_assets,
  public.visits,
  public.visitors,
  public.badges,
  public.blacklist,
  public.notifications,
  public.user_roles,
  public.profiles
RESTART IDENTITY CASCADE;

-- 2. Wipe all auth users
DELETE FROM auth.users;

-- 3. Ensure trigger exists so signups auto-create profile + default role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Seed fresh admin account
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated', 'authenticated',
    'enochokurapa@gmail.com',
    crypt('Admin@12345', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Administrator"}'::jsonb,
    now(), now(), '', '', '', ''
  );

  -- Upgrade the auto-assigned 'host' role to 'admin'
  UPDATE public.user_roles
     SET role = 'admin'
   WHERE user_id = new_user_id;
END $$;