alter policy "Authenticated users manage visitors"
on public.visitors
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage visits"
on public.visits
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage visit assets"
on public.visit_assets
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage badges"
on public.badges
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage blacklist"
on public.blacklist
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage profiles"
on public.profiles
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage roles"
on public.user_roles
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter policy "Authenticated users manage notifications"
on public.notifications
using (auth.uid() is not null)
with check (auth.uid() is not null);