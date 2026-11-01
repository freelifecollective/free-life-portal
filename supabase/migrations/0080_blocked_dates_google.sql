-- Phase 102: block specific dates, and link a Google Calendar so busy times are not offered to leads.
create table if not exists public.coach_blocked_dates (
  member_id uuid not null references public.profiles (id) on delete cascade,
  day       date not null,
  note      text check (note is null or char_length(note) <= 80),
  primary key (member_id, day)
);
alter table public.coach_blocked_dates enable row level security;
drop policy if exists cbd_own on public.coach_blocked_dates;
create policy cbd_own on public.coach_blocked_dates for all to authenticated
  using (member_id = auth.uid() and public.can_see('member')) with check (member_id = auth.uid() and public.can_see('member'));

-- the Google link: the secret token is never readable by the browser (no policies); the website's server reads it with its own key
create table if not exists public.google_calendar_links (
  member_id     uuid primary key references public.profiles (id) on delete cascade,
  refresh_token text not null,
  email         text,
  created_at    timestamptz not null default now()
);
alter table public.google_calendar_links enable row level security;

create or replace function public.my_google_calendar() returns table (connected boolean, email text)
language sql stable security definer set search_path = public, pg_temp
as $$ select true, g.email from public.google_calendar_links g where g.member_id = auth.uid() $$;
revoke all on function public.my_google_calendar() from public, anon;
grant execute on function public.my_google_calendar() to authenticated;

create or replace function public.disconnect_google_calendar() returns void
language sql security definer set search_path = public, pg_temp
as $$ delete from public.google_calendar_links where member_id = auth.uid() $$;
revoke all on function public.disconnect_google_calendar() from public, anon;
grant execute on function public.disconnect_google_calendar() to authenticated;

-- free times now also skip the blocked dates
create or replace function public.open_slots(p_days integer default 14) returns table (slot timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare coach uuid := public.my_coach(); target uuid; mins integer; zone text; step integer; notice integer; ahead integer; pre integer; post integer; cap integer;
        d date; a record; s integer;
begin
  if coach is null or not public.can_see('lead') then return; end if;
  target := public.booking_target(coach);
  select coalesce(cs.call_minutes, 30), coalesce(cs.tz, 'America/New_York'), coalesce(cs.interval_minutes, cs.call_minutes, 30), coalesce(cs.min_notice_hours, 2),
         coalesce(cs.max_days_ahead, 14), coalesce(cs.buffer_before, 0), coalesce(cs.buffer_after, 0), cs.max_per_day
    into mins, zone, step, notice, ahead, pre, post, cap
    from (select 1) x left join public.coach_settings cs on cs.member_id = target;
  for d in select generate_series((now() at time zone zone)::date, (now() at time zone zone)::date + least(greatest(coalesce(p_days, 14), 1), ahead), interval '1 day')::date loop
    if exists (select 1 from public.coach_blocked_dates b where b.member_id = target and b.day = d) then continue; end if;
    if cap is not null and (select count(*) from public.booked_calls b where coalesce(b.closer_id, b.member_id) = target and (b.starts_at at time zone zone)::date = d) >= cap then continue; end if;
    for a in select * from public.coach_availability where member_id = target and weekday = extract(dow from d)::int order by start_min loop
      s := a.start_min;
      while s + mins <= a.end_min loop
        slot := ((d::timestamp + make_interval(mins => s)) at time zone zone);
        if slot > now() + make_interval(hours => notice)
           and not exists (select 1 from public.booked_calls b where coalesce(b.closer_id, b.member_id) = target
                             and b.starts_at - make_interval(mins => pre) < slot + make_interval(mins => mins + post)
                             and b.starts_at + make_interval(mins => mins + post) > slot - make_interval(mins => pre)) then
          return next;
        end if;
        s := s + step;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function public.open_slots(integer) from public, anon;
grant execute on function public.open_slots(integer) to authenticated;
notify pgrst, 'reload schema';
