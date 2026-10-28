-- Phase 3: calls, RSVPs, lead registration, invite-only sign-up, email outbox.

-- ---------------------------------------------------------------- profile email (private)
alter table public.profiles add column email citext;
update public.profiles p set email = lower(u.email)::citext from auth.users u where u.id = p.id and p.email is null;
create index profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------- sign-up allow-list
-- Only these emails (plus anonymous visitors, which stay switched off in production) can create an account.
create table public.signup_allowlist (
  email      citext primary key,
  role       public.app_role not null default 'lead',
  note       text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint allowlist_email_fmt check (email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' and char_length(email::text) <= 254),
  constraint allowlist_role_not_admin check (role <> 'admin')
);
alter table public.signup_allowlist enable row level security;
create policy allowlist_admin on public.signup_allowlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- calls
create type public.call_audience as enum ('leads_open', 'affiliates_only');
create type public.call_kind as enum ('community', 'masterclass', 'other');

create table public.calls (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  kind             public.call_kind not null default 'community',
  audience         public.call_audience not null default 'leads_open',
  starts_at        timestamptz not null,
  duration_minutes integer not null default 60,
  pinned           boolean not null default false,
  join_url         text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint calls_title_len check (char_length(btrim(title)) between 1 and 120),
  constraint calls_description_len check (description is null or char_length(description) <= 2000),
  constraint calls_duration check (duration_minutes between 15 and 480),
  constraint calls_join_url check (join_url is null or join_url ~ '^https://')
);
create index calls_starts_at_idx on public.calls (starts_at);
alter table public.calls enable row level security;
-- Leads see leads-open calls; members and admins see everything.
create policy calls_select on public.calls for select to authenticated using (
  public.can_see('member') or (audience = 'leads_open' and public.can_see('lead'))
);
create policy calls_admin_write on public.calls for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger calls_touch before update on public.calls for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RSVPs
create type public.rsvp_mode as enum ('live', 'recording');
create table public.rsvps (
  call_id    uuid not null references public.calls (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  mode       public.rsvp_mode not null,
  created_at timestamptz not null default now(),
  primary key (call_id, user_id)
);
create index rsvps_call_mode_idx on public.rsvps (call_id, mode);
alter table public.rsvps enable row level security;
create policy rsvps_select_own on public.rsvps for select to authenticated using (user_id = auth.uid());
-- inserting only works for calls the member is allowed to see (the subquery obeys the calls policy)
create policy rsvps_insert_own on public.rsvps for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.calls c where c.id = call_id));
create policy rsvps_update_own on public.rsvps for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.calls c where c.id = call_id));
create policy rsvps_delete_own on public.rsvps for delete to authenticated using (user_id = auth.uid());

-- Counts for any size of call plus the first few people to show as picture bubbles.
create function public.call_rsvp_summary(p_call uuid, p_limit integer default 12) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare visible boolean; live_n integer; rec_n integer; mine public.rsvp_mode; people jsonb;
begin
  select exists (select 1 from public.calls c where c.id = p_call
    and (public.can_see('member') or (c.audience = 'leads_open' and public.can_see('lead')))) into visible;
  if not visible then return null; end if;
  select count(*) filter (where mode = 'live'), count(*) filter (where mode = 'recording') into live_n, rec_n from public.rsvps where call_id = p_call;
  select mode into mine from public.rsvps where call_id = p_call and user_id = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(pr.first_name, ''), 'username', pr.username, 'avatar_url', pr.avatar_url, 'mode', r.mode) order by r.created_at), '[]'::jsonb)
    into people
    from (select * from public.rsvps where call_id = p_call order by created_at limit greatest(least(coalesce(p_limit, 12), 50), 0)) r
    join public.profiles pr on pr.id = r.user_id where pr.onboarded_at is not null;
  return jsonb_build_object('live', live_n, 'recording', rec_n, 'mine', mine, 'people', people);
end $$;
revoke all on function public.call_rsvp_summary(uuid, integer) from public, anon;
grant execute on function public.call_rsvp_summary(uuid, integer) to authenticated;

-- ---------------------------------------------------------------- lead registration
create table public.registrations (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid not null references public.calls (id) on delete cascade,
  name       text not null,
  email      citext not null,
  consent_at timestamptz not null default now(),
  claimed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (call_id, email)
);
create index registrations_email_idx on public.registrations (email);
alter table public.registrations enable row level security;
create policy registrations_admin on public.registrations for select to authenticated using (public.is_admin());

-- Mail waiting to be sent (sending is wired up once the email service and domain exist).
create table public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_email   citext not null,
  template   text not null,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts   integer not null default 0,
  error      text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
alter table public.email_outbox enable row level security;
create policy outbox_admin on public.email_outbox for select to authenticated using (public.is_admin());

-- What a lead may see before they have an account: only upcoming, leads-open calls.
create function public.public_call(p_call uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'starts_at', c.starts_at, 'duration_minutes', c.duration_minutes)
  from public.calls c
  where c.id = p_call and c.audience = 'leads_open' and c.starts_at + make_interval(mins => c.duration_minutes) > now()
$$;
revoke all on function public.public_call(uuid) from public;
grant execute on function public.public_call(uuid) to anon, authenticated;

create function public.register_for_call(p_call uuid, p_name text, p_email text, p_consent boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_email citext := lower(btrim(coalesce(p_email, '')))::citext;
  c       public.calls;
  fresh   integer;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 80 then return jsonb_build_object('ok', false, 'reason', 'invalid_name'); end if;
  if char_length(v_email::text) > 254 or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;
  if not coalesce(p_consent, false) then return jsonb_build_object('ok', false, 'reason', 'consent_required'); end if;

  select * into c from public.calls
   where id = p_call and audience = 'leads_open' and starts_at + make_interval(mins => duration_minutes) > now();
  if not found then return jsonb_build_object('ok', false, 'reason', 'call_unavailable'); end if;

  insert into public.registrations (call_id, name, email) values (p_call, v_name, v_email) on conflict (call_id, email) do nothing;
  get diagnostics fresh = row_count;
  insert into public.signup_allowlist (email, role, note) values (v_email, 'lead', 'registered for ' || c.title) on conflict (email) do nothing;

  if fresh > 0 then
    insert into public.email_outbox (to_email, template, payload) values
      (v_email, 'registration_confirmation', jsonb_build_object('name', v_name, 'call_id', c.id, 'title', c.title, 'starts_at', c.starts_at));
  end if;
  -- the same answer whether or not this email was already known
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.register_for_call(uuid, text, text, boolean) from public;
grant execute on function public.register_for_call(uuid, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------- invite-only sign-up
create function public.enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if coalesce(new.is_anonymous, false) then return new; end if; -- only possible while anonymous sign-ins are switched on (testing)
  if new.email is not null and exists (select 1 from public.signup_allowlist a where a.email = lower(new.email)::citext) then return new; end if;
  raise exception 'signups_closed' using errcode = 'P0001', hint = 'This email has not been invited.';
end $$;
create trigger enforce_signup_allowlist before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.signup_allowlist;
begin
  select * into a from public.signup_allowlist where email = lower(new.email)::citext;
  insert into public.profiles (id, email, role)
    values (new.id, lower(new.email)::citext, coalesce(a.role, 'lead'))
    on conflict (id) do nothing;
  if a.email is not null then
    update public.signup_allowlist set claimed_at = now() where email = a.email;
    update public.registrations set claimed_by = new.id where email = a.email;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- profile rules: email is private and fixed
create or replace function public.profiles_before_write() returns trigger
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
    if new.email is distinct from old.email then raise exception 'email cannot be changed here' using errcode = '42501'; end if;
    if new.role is distinct from old.role then raise exception 'role can only be changed by an admin' using errcode = '42501'; end if;
    if new.coach_id is distinct from old.coach_id then raise exception 'coach can only be changed by an admin' using errcode = '42501'; end if;
    if old.onboarded_at is not null and new.onboarded_at is distinct from old.onboarded_at then
      raise exception 'onboarding is already complete' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- admin sign-up invites
-- (admins add rows to signup_allowlist directly; this view lists the people already in the portal)
