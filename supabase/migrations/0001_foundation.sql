-- Free Life Collective portal: foundation (phases 1 and 2)
-- Roles, profiles, username rules, visibility helpers, avatar storage.
-- Rank is NOT stored on profiles. It lives with the Accountability Buddy answers (phase 7).

create extension if not exists citext;

-- ---------------------------------------------------------------- types
create type public.app_role as enum ('lead', 'member', 'admin');
create type public.avatar_kind as enum ('upload', 'generated', 'monogram');

-- ---------------------------------------------------------------- ranks
create table public.ranks (
  id   smallint primary key,
  name text not null unique,
  sort smallint not null unique
);
insert into public.ranks (id, name, sort) values
  (1, '1A', 1), (2, '2A', 2), (3, '3A', 3), (4, '4A', 4), (5, '5A', 5), (6, '6A', 6), (7, '6A+', 7);
alter table public.ranks enable row level security;
create policy ranks_read on public.ranks for select to authenticated using (true);

-- ---------------------------------------------------------------- reserved usernames
create table public.reserved_usernames (username citext primary key);
insert into public.reserved_usernames (username) values
  ('admin'), ('login'), ('api'), ('support'), ('settings'), ('root'), ('help'), ('portal'), ('community'),
  ('calendar'), ('classroom'), ('profile'), ('dashboard'), ('team'), ('calls'), ('documents'), ('search'),
  ('welcome'), ('auth'), ('logout'), ('signup'), ('channels'), ('courses'), ('recordings'), ('buddy'),
  ('calculator'), ('graphics'), ('messages'), ('notifications'), ('onboarding'), ('privacy'), ('terms');
alter table public.reserved_usernames enable row level security;
-- no policies: only security definer functions and the service role read this table

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  first_name   text,
  last_name    text,
  username     citext unique,
  instagram    text,
  facebook     text,
  avatar_url   text,
  avatar_kind  public.avatar_kind,
  role         public.app_role not null default 'lead',
  coach_id     uuid references public.profiles (id) on delete set null,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_first_name_len check (first_name is null or char_length(btrim(first_name)) between 1 and 40),
  constraint profiles_last_name_len  check (last_name  is null or char_length(btrim(last_name))  between 1 and 40),
  constraint profiles_username_fmt   check (username is null or username::text ~ '^[a-z0-9_-]{3,30}$'),
  constraint profiles_instagram_fmt  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  constraint profiles_facebook_fmt   check (facebook  is null or facebook  ~ '^[A-Za-z0-9.]{5,50}$'),
  constraint profiles_onboarded_complete check (
    onboarded_at is null or (first_name is not null and last_name is not null and username is not null)
  )
);
create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------- role helpers
create function public.role_rank(r public.app_role) returns integer
language sql immutable parallel safe
as $$ select case r when 'lead' then 1 when 'member' then 2 when 'admin' then 3 end $$;

create function public.app_current_role() returns public.app_role
language sql stable security definer set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid() $$;

-- Visibility helper used by every content table in later phases:
--   create policy ... using (public.can_see(min_role))
create function public.can_see(min_role public.app_role) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(public.role_rank(public.app_current_role()) >= public.role_rank(min_role), false) $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(public.app_current_role() = 'admin', false) $$;

-- ---------------------------------------------------------------- new user -> profile row
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- username + column rules
create function public.is_reserved_username(candidate text) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.reserved_usernames where username = lower(candidate)::citext) $$;
revoke all on function public.is_reserved_username(text) from public, anon;
grant execute on function public.is_reserved_username(text) to authenticated;

-- SECURITY INVOKER on purpose: current_user must be the role making the request
-- (authenticated, anon or service_role), not the function owner.
create function public.profiles_before_write() returns trigger
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  by_user boolean := current_user in ('authenticated', 'anon');
begin
  new.updated_at := now();

  if new.username is not null then
    new.username := lower(new.username::text)::citext;
    if (tg_op = 'INSERT' or new.username is distinct from old.username)
       and public.is_reserved_username(new.username::text) then
      raise exception 'username_reserved' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and by_user and not public.is_admin() then
    if new.id is distinct from old.id then raise exception 'profile id is immutable' using errcode = '42501'; end if;
    if new.role is distinct from old.role then raise exception 'role can only be changed by an admin' using errcode = '42501'; end if;
    if new.coach_id is distinct from old.coach_id then raise exception 'coach can only be changed by an admin' using errcode = '42501'; end if;
    if old.onboarded_at is not null and new.onboarded_at is distinct from old.onboarded_at then
      raise exception 'onboarding is already complete' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_before_write before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- Authoritative availability check (the unique index is the final guard).
create function public.check_username(candidate text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare u text := lower(coalesce(candidate, ''));
begin
  if char_length(u) < 3 then return jsonb_build_object('ok', false, 'reason', 'too_short'); end if;
  if char_length(u) > 30 then return jsonb_build_object('ok', false, 'reason', 'too_long'); end if;
  if u !~ '^[a-z0-9_-]+$' then return jsonb_build_object('ok', false, 'reason', 'bad_chars'); end if;
  if exists (select 1 from public.reserved_usernames where username = u::citext) then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;
  if exists (select 1 from public.profiles where username = u::citext and id is distinct from auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.check_username(text) from public, anon;
grant execute on function public.check_username(text) to authenticated;

-- ---------------------------------------------------------------- RLS: profiles
alter table public.profiles enable row level security;
create policy profiles_select_own   on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_update_own   on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- no insert policy (trigger creates rows) and no delete policy (cascade from auth.users)

-- Safe, public-facing fields only. Other members see this, never the table.
create view public.profile_cards as
  select id, first_name, username, avatar_url, instagram, facebook
  from public.profiles
  where onboarded_at is not null;
revoke all on public.profile_cards from public, anon;
grant select on public.profile_cards to authenticated;

-- ---------------------------------------------------------------- storage: avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
