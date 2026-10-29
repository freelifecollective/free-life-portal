-- Home dashboard: who leads each call, landing page visits and clicks, who watched a replay, and the stats and lead list built from them.

alter table public.calls add column host text check (host is null or char_length(btrim(host)) between 1 and 80);

-- ---------------------------------------------------------------- landing page visits and clicks
create table public.landing_events (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('visit', 'click')),
  visitor    text not null check (visitor ~ '^[A-Za-z0-9_-]{8,64}$'),
  created_at timestamptz not null default now()
);
create index landing_events_member_idx on public.landing_events (member_id, created_at);
alter table public.landing_events enable row level security;
-- no policies: written by track_landing(), read through member_stats()

-- A page opened or a button tapped. The same visitor is only counted once per 30 minutes (visits) or 10 seconds (clicks).
create function public.track_landing(p_username text, p_kind text, p_visitor text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m uuid;
begin
  if p_kind not in ('visit', 'click') or p_visitor is null or p_visitor !~ '^[A-Za-z0-9_-]{8,64}$' then return; end if;
  select id into m from public.profiles
   where username = lower(btrim(coalesce(p_username, '')))::citext and role in ('member', 'admin') and onboarded_at is not null;
  if m is null then return; end if;
  if exists (select 1 from public.landing_events e where e.member_id = m and e.kind = p_kind and e.visitor = p_visitor
             and e.created_at > now() - case p_kind when 'visit' then interval '30 minutes' else interval '10 seconds' end) then return; end if;
  insert into public.landing_events (member_id, kind, visitor) values (m, p_kind, p_visitor);
end $$;
revoke all on function public.track_landing(text, text, text) from public;
grant execute on function public.track_landing(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- who watched a replay
create table public.recording_views (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  recording_id    uuid not null references public.recordings (id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (user_id, recording_id)
);
alter table public.recording_views enable row level security;
create policy rv_read on public.recording_views for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy rv_insert on public.recording_views for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.recordings r where r.id = recording_id));

-- ---------------------------------------------------------------- the numbers
-- Visitors (different people), clicks, form fill-outs (people who registered for a call through the link) and how many of
-- those then created a portal account, for one date range. p_call adds how many registered for that particular call.
create function public.member_stats(p_from timestamptz, p_to timestamptz, p_call uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.can_see('member') then return null; end if;
  return jsonb_build_object(
    'visitors', (select count(distinct visitor) from public.landing_events where member_id = me and kind = 'visit' and created_at >= p_from and created_at < p_to),
    'clicks',   (select count(*) from public.landing_events where member_id = me and kind = 'click' and created_at >= p_from and created_at < p_to),
    'forms',    (select count(distinct email) from public.registrations where referrer_id = me and created_at >= p_from and created_at < p_to),
    'registered', (select count(distinct email) from public.registrations where referrer_id = me and claimed_by is not null and created_at >= p_from and created_at < p_to),
    'call_registered', case when p_call is null then 0 else (select count(*) from public.registrations where referrer_id = me and call_id = p_call) end);
end $$;
revoke all on function public.member_stats(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.member_stats(timestamptz, timestamptz, uuid) to authenticated;

-- Everyone who filled in the form through the member's link, one row per person, with what they did on each call they signed up for.
create function public.my_leads(p_from timestamptz, p_to timestamptz, p_member uuid default null)
returns table (email text, first_name text, last_name text, filled_at timestamptz, registered_at timestamptz, calls jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare owner uuid := coalesce(p_member, auth.uid());
begin
  if auth.uid() is null or not (owner = auth.uid() or public.is_admin()) or not public.can_see('member') then return; end if;
  return query
    select r.email::text,
           (array_agg(r.first_name order by r.created_at desc))[1],
           (array_agg(r.last_name order by r.created_at desc))[1],
           min(r.created_at),
           (select pr.created_at from public.profiles pr where pr.id = (array_agg(r.claimed_by) filter (where r.claimed_by is not null))[1]),
           coalesce(jsonb_agg(jsonb_build_object(
             'call_id', c.id, 'title', c.title, 'starts_at', c.starts_at,
             'attended', exists (select 1 from public.call_attendance a where a.call_id = c.id and a.user_id = r.claimed_by),
             'replay', exists (select 1 from public.recording_views v join public.recordings rc on rc.id = v.recording_id
                                where rc.call_id = c.id and v.user_id = r.claimed_by)) order by c.starts_at desc), '[]'::jsonb)
      from public.registrations r join public.calls c on c.id = r.call_id
     where r.referrer_id = owner and r.created_at >= p_from and r.created_at < p_to
     group by r.email
     order by min(r.created_at) desc;
end $$;
revoke all on function public.my_leads(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.my_leads(timestamptz, timestamptz, uuid) to authenticated;
