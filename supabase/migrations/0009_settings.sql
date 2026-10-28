-- Profile settings: private rank, and an "Admin" flag other members can see next to a name.

create table public.member_private (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  rank_id   smallint references public.ranks (id),
  updated_at timestamptz not null default now()
);
alter table public.member_private enable row level security;
-- Only the member (and admins) can read it. Other members never see it here; the Water Share Map will expose rank through its own function.
create policy mp_read_own on public.member_private for select to authenticated using (member_id = auth.uid());
create policy mp_read_admin on public.member_private for select to authenticated using (public.is_admin());
create policy mp_insert_own on public.member_private for insert to authenticated with check (member_id = auth.uid() and public.can_see('member'));
create policy mp_update_own on public.member_private for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid() and public.can_see('member'));

create or replace view public.profile_cards as
  select id, first_name, username, avatar_url, instagram, facebook, last_name, (role = 'admin') as is_admin
  from public.profiles
  where onboarded_at is not null;
