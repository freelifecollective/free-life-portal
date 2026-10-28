-- Phase 4: member landing pages, referral tracking, and the shared registration counter.

-- ---------------------------------------------------------------- more reserved names (every top-level page of the site)
insert into public.reserved_usernames (username) values
  ('register'), ('join'), ('invite'), ('home'), ('public'), ('static'), ('assets'), ('images'), ('favicon'),
  ('robots'), ('sitemap'), ('manifest'), ('unsubscribe'), ('thanks'), ('links')
on conflict do nothing;

-- ---------------------------------------------------------------- landing page settings (one row per member)
-- A page shows the member's profile picture and social links unless they set their own here.
--   instagram / facebook: null = use the profile's, '' = show none, otherwise = show this one on the page only
create table public.landing_pages (
  member_id  uuid primary key references public.profiles (id) on delete cascade,
  photo_url  text,
  instagram  text,
  facebook   text,
  theme      text not null default 'light' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now(),
  constraint landing_instagram_fmt check (instagram is null or instagram = '' or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  constraint landing_facebook_fmt  check (facebook  is null or facebook  = '' or facebook  ~ '^[A-Za-z0-9.]{5,50}$')
);
alter table public.landing_pages enable row level security;
create policy landing_select_own on public.landing_pages for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy landing_insert_own on public.landing_pages for insert to authenticated with check (member_id = auth.uid() and public.can_see('member'));
create policy landing_update_own on public.landing_pages for update to authenticated
  using (member_id = auth.uid() and public.can_see('member')) with check (member_id = auth.uid() and public.can_see('member'));
create policy landing_delete_own on public.landing_pages for delete to authenticated using (member_id = auth.uid());
create trigger landing_touch before update on public.landing_pages for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- landing page pictures
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing', 'landing', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy landing_read on storage.objects for select using (bucket_id = 'landing');
create policy landing_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'landing' and (storage.foldername(name))[1] = auth.uid()::text and public.can_see('member'));
create policy landing_update_own on storage.objects for update to authenticated
  using (bucket_id = 'landing' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'landing' and (storage.foldername(name))[1] = auth.uid()::text);
create policy landing_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'landing' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- what a visitor may see of a member (nothing private)
create function public.public_landing(p_username text) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'member_id', p.id,
    'username', p.username,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'photo_url', coalesce(l.photo_url, p.avatar_url),
    'instagram', case when l.instagram is null then p.instagram when l.instagram = '' then null else l.instagram end,
    'facebook',  case when l.facebook  is null then p.facebook  when l.facebook  = '' then null else l.facebook  end,
    'theme', coalesce(l.theme, 'light'))
  from public.profiles p left join public.landing_pages l on l.member_id = p.id
  where p.username = lower(btrim(p_username))::citext and p.role in ('member', 'admin') and p.onboarded_at is not null
$$;
revoke all on function public.public_landing(text) from public;
grant execute on function public.public_landing(text) to anon, authenticated;

-- ---------------------------------------------------------------- referral and names on registrations
alter table public.registrations add column first_name text, add column last_name text,
  add column referrer_id uuid references public.profiles (id) on delete set null;
create index registrations_referrer_idx on public.registrations (referrer_id);

-- ---------------------------------------------------------------- one counter for everyone's pages
create function public.is_open_call(p_call uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.calls where id = p_call and audience = 'leads_open') $$;
revoke all on function public.is_open_call(uuid) from public;
grant execute on function public.is_open_call(uuid) to anon, authenticated;

create table public.call_stats (
  call_id    uuid primary key references public.calls (id) on delete cascade,
  registered integer not null default 0 check (registered >= 0)
);
alter table public.call_stats enable row level security;
create policy call_stats_read on public.call_stats for select to anon, authenticated using (public.is_open_call(call_id));

create function public.bump_call_stats() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.call_stats (call_id, registered) values (new.call_id, 1)
      on conflict (call_id) do update set registered = public.call_stats.registered + 1;
  elsif tg_op = 'DELETE' then
    update public.call_stats set registered = greatest(registered - 1, 0) where call_id = old.call_id;
  end if;
  return null;
end $$;
create trigger registrations_stats after insert or delete on public.registrations for each row execute function public.bump_call_stats();
insert into public.call_stats (call_id, registered) select call_id, count(*) from public.registrations group by call_id on conflict do nothing;

-- Live updates: every open page hears about counter changes as they happen.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.call_stats;
  end if;
end $$;

-- The call every landing page promotes: the soonest upcoming leads-open call, with its counter.
create function public.next_public_call() returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'starts_at', c.starts_at,
    'duration_minutes', c.duration_minutes, 'registered', coalesce(s.registered, 0))
  from public.calls c left join public.call_stats s on s.call_id = c.id
  where c.audience = 'leads_open' and c.starts_at + make_interval(mins => c.duration_minutes) > now()
  order by c.pinned desc, c.starts_at limit 1
$$;
revoke all on function public.next_public_call() from public;
grant execute on function public.next_public_call() to anon, authenticated;

-- ---------------------------------------------------------------- registration now takes first and last name and who invited them
drop function public.register_for_call(uuid, text, text, boolean);
create function public.register_for_call(p_call uuid, p_first text, p_last text, p_email text, p_consent boolean, p_referrer text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_first text := btrim(coalesce(p_first, ''));
  v_last  text := btrim(coalesce(p_last, ''));
  v_email citext := lower(btrim(coalesce(p_email, '')))::citext;
  c       public.calls;
  ref     uuid;
  fresh   integer;
begin
  if char_length(v_first) < 1 or char_length(v_first) > 40 then return jsonb_build_object('ok', false, 'reason', 'invalid_name'); end if;
  if char_length(v_last) < 1 or char_length(v_last) > 40 then return jsonb_build_object('ok', false, 'reason', 'invalid_name'); end if;
  if char_length(v_email::text) > 254 or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;
  if not coalesce(p_consent, false) then return jsonb_build_object('ok', false, 'reason', 'consent_required'); end if;

  select * into c from public.calls
   where id = p_call and audience = 'leads_open' and starts_at + make_interval(mins => duration_minutes) > now();
  if not found then return jsonb_build_object('ok', false, 'reason', 'call_unavailable'); end if;

  select id into ref from public.profiles
   where username = lower(btrim(coalesce(p_referrer, '')))::citext and role in ('member', 'admin') and onboarded_at is not null;

  insert into public.registrations (call_id, name, first_name, last_name, email, referrer_id)
    values (p_call, v_first || ' ' || v_last, v_first, v_last, v_email, ref) on conflict (call_id, email) do nothing;
  get diagnostics fresh = row_count;
  insert into public.signup_allowlist (email, role, note) values (v_email, 'lead', 'registered for ' || c.title) on conflict (email) do nothing;

  if fresh > 0 then
    insert into public.email_outbox (to_email, template, payload) values
      (v_email, 'registration_confirmation', jsonb_build_object('name', v_first, 'call_id', c.id, 'title', c.title, 'starts_at', c.starts_at));
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.register_for_call(uuid, text, text, text, boolean, text) from public;
grant execute on function public.register_for_call(uuid, text, text, text, boolean, text) to anon, authenticated;
