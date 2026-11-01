-- Phase 93: booking rules for coaching calls (like GoHighLevel): slot spacing, notice, how far ahead, buffers and a daily limit.
alter table public.coach_settings add column if not exists interval_minutes smallint check (interval_minutes is null or (interval_minutes between 5 and 120 and interval_minutes % 5 = 0));
alter table public.coach_settings add column if not exists min_notice_hours integer not null default 2 check (min_notice_hours between 0 and 720);
alter table public.coach_settings add column if not exists max_days_ahead smallint not null default 14 check (max_days_ahead between 1 and 60);
alter table public.coach_settings add column if not exists buffer_before smallint not null default 0 check (buffer_before between 0 and 120);
alter table public.coach_settings add column if not exists buffer_after smallint not null default 0 check (buffer_after between 0 and 120);
alter table public.coach_settings add column if not exists max_per_day smallint check (max_per_day is null or max_per_day between 1 and 50);

-- free times: follows the rules above (the defaults behave exactly as before)
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
