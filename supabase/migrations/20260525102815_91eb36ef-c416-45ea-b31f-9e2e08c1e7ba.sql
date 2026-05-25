drop policy if exists "Reception/security/admin insert visitors" on public.visitors;
drop policy if exists "Reception/security/admin update visitors" on public.visitors;
drop policy if exists "Admin delete visitors" on public.visitors;
drop policy if exists "Staff view visitors" on public.visitors;
create policy "Authenticated users manage visitors"
on public.visitors
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Reception/security/admin insert visits" on public.visits;
drop policy if exists "Reception/security/admin/host update visits" on public.visits;
drop policy if exists "Admin delete visits" on public.visits;
drop policy if exists "Staff view visits" on public.visits;
create policy "Authenticated users manage visits"
on public.visits
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Reception/security/admin manage assets" on public.visit_assets;
drop policy if exists "Staff view assets" on public.visit_assets;
create policy "Authenticated users manage visit assets"
on public.visit_assets
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admin/security manage badges" on public.badges;
drop policy if exists "Staff view badges" on public.badges;
create policy "Authenticated users manage badges"
on public.badges
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admin delete blacklist" on public.blacklist;
drop policy if exists "Admin manage blacklist" on public.blacklist;
drop policy if exists "Host/admin insert blacklist" on public.blacklist;
drop policy if exists "Staff view blacklist" on public.blacklist;
create policy "Authenticated users manage blacklist"
on public.blacklist
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admin manages profiles" on public.profiles;
drop policy if exists "Staff can view all profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Authenticated users manage profiles"
on public.profiles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admin manages roles" on public.user_roles;
drop policy if exists "Users view own roles" on public.user_roles;
create policy "Authenticated users manage roles"
on public.user_roles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff insert notifications" on public.notifications;
drop policy if exists "Users delete own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Users view own notifications" on public.notifications;
create policy "Authenticated users manage notifications"
on public.notifications
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Reception/admin upload id-scans" on storage.objects;
drop policy if exists "Reception/admin update id-scans" on storage.objects;
drop policy if exists "Admin delete id-scans" on storage.objects;
drop policy if exists "Staff view id-scans" on storage.objects;
create policy "Authenticated users manage id-scans"
on storage.objects
for all
to authenticated
using (bucket_id = 'id-scans')
with check (bucket_id = 'id-scans');