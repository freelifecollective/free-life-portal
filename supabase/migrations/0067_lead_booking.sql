-- Lead booking: an affiliate sets their open hours, and a lead picks a free time. If the affiliate has a hired call closer
-- (one who accepted), the lead books the closer's open hours and the call goes to the closer.
create table if not exists public.coach_settings (
  member_id    uuid primary key references public.profiles (id) on delete cascade,
  call_minutes smallint not null default 30 check (call_minutes in (15, 30, 45, 60)),
  tz           text not null default 'America/New_York' check (char_length(tz) between 3 and 60),
  updated_at   timestamptz not null default now()
);
create table if not exists public.coach_availability (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  weekday   smallint not null check (weekday between 0 and 6),   -- 0 is Sunday
  start_min smallint not null check (start_min between 0 and 1439),
  end_min   smallint not null check (end_min between 1 and 1440),
  check (end_min > start_min),
  unique (member_id, weekday, start_min)
);
alter table public.coach_settings enable row level security;
alter table public.coach_availability enable row level security;
drop policy if exists cs_own on public.coach_settings;
create policy cs_own on public.coach_settings for all to authenticated using (member_id = auth.uid() and public.can_see('member')) with check (member_id = auth.uid() and public.can_see('member'));
drop policy if exists ca_own on public.coach_availability;
create policy ca_own on public.coach_availability for all to authenticated using (member_id = auth.uid() and public.can_see('member')) with check (member_id = auth.uid() and public.can_see('member'));

alter table public.booked_calls add column if not exists lead_id uuid references public.profiles (id) on delete set null;
create unique index if not exists booked_calls_one_per_time on public.booked_calls (coalesce(closer_id, member_id), starts_at);
drop policy if exists bc_read_lead on public.booked_calls;
create policy bc_read_lead on public.booked_calls for select to authenticated using (lead_id = auth.uid());

-- the affiliate who brought this lead in
create or replace function public.my_coach() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select r.referrer_id from public.registrations r where r.claimed_by = auth.uid() and r.referrer_id is not null order by r.created_at desc limit 1 $$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;

-- whose open hours a lead books: the hired closer if there is one, otherwise the affiliate
create or replace function public.booking_target(p_coach uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select h.closer_id from public.closer_hires h where h.member_id = p_coach and h.status = 'active' limit 1), p_coach) $$;

create or replace function public.booking_info()
returns table (coach_id uuid, coach_name text, target_id uuid, target_name text, with_closer boolean, call_minutes integer, tz text, has_hours boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  with c as (select public.my_coach() as coach), t as (select c.coach, public.booking_target(c.coach) as target from c where c.coach is not null)
  select t.coach, nullif(btrim(coalesce(pc.first_name, '') || ' ' || coalesce(pc.last_name, '')), ''),
         t.target, nullif(btrim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, '')), ''), t.target <> t.coach,
         coalesce(cs.call_minutes, 30)::int, coalesce(cs.tz, 'America/New_York'), exists (select 1 from public.coach_availability a where a.member_id = t.target)
    from t join public.profiles pc on pc.id = t.coach join public.profiles pt on pt.id = t.target left join public.coach_settings cs on cs.member_id = t.target
   where public.can_see('lead')
$$;
revoke all on function public.booking_info() from public, anon;
grant execute on function public.booking_info() to authenticated;

-- free times for the next p_days days (at least two hours from now)
create or replace function public.open_slots(p_days integer default 14) returns table (slot timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare coach uuid := public.my_coach(); target uuid; mins integer; zone text; d date; a record; s integer;
begin
  if coach is null or not public.can_see('lead') then return; end if;
  target := public.booking_target(coach);
  select coalesce(cs.call_minutes, 30), coalesce(cs.tz, 'America/New_York') into mins, zone from (select 1) x left join public.coach_settings cs on cs.member_id = target;
  for d in select generate_series((now() at time zone zone)::date, (now() at time zone zone)::date + least(greatest(coalesce(p_days, 14), 1), 60), interval '1 day')::date loop
    for a in select * from public.coach_availability where member_id = target and weekday = extract(dow from d)::int order by start_min loop
      s := a.start_min;
      while s + mins <= a.end_min loop
        slot := ((d::timestamp + make_interval(mins => s)) at time zone zone);
        if slot > now() + interval '2 hours'
           and not exists (select 1 from public.booked_calls b where coalesce(b.closer_id, b.member_id) = target and b.starts_at < slot + make_interval(mins => mins) and b.starts_at + make_interval(mins => mins) > slot) then
          return next;
        end if;
        s := s + mins;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function public.open_slots(integer) from public, anon;
grant execute on function public.open_slots(integer) to authenticated;

create or replace function public.book_coaching_call(p_start timestamptz) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); coach uuid := public.my_coach(); nm text; bid uuid;
begin
  if me is null or coach is null or not public.can_see('lead') then raise exception 'no coach to book with' using errcode = '42501'; end if;
  if not exists (select 1 from public.open_slots(60) o where o.slot = p_start) then raise exception 'that time is not available' using errcode = 'P0002'; end if;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'A lead') into nm from public.profiles where id = me;
  begin
    insert into public.booked_calls (member_id, lead_name, starts_at, lead_id) values (coach, left(nm, 80), p_start, me) returning id into bid;
  exception when unique_violation then raise exception 'that time was just taken' using errcode = '23505';
  end;
  perform public.notify_user(coach, 'announcement', nm || ' booked a coaching call',
    to_char(p_start at time zone 'America/New_York', 'FMDay, FMMon FMDD "at" FMHH12:MI AM') || ' ET', '/');
  return bid;
end $$;
revoke all on function public.book_coaching_call(timestamptz) from public, anon;
grant execute on function public.book_coaching_call(timestamptz) to authenticated;

create or replace function public.cancel_my_booking(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare b public.booked_calls; nm text;
begin
  select * into b from public.booked_calls where id = p_id and lead_id = auth.uid() and starts_at > now() for update;
  if b.id is null then return; end if;
  delete from public.booked_calls where id = p_id;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'A lead') into nm from public.profiles where id = auth.uid();
  perform public.notify_user(b.member_id, 'announcement', nm || ' cancelled their coaching call',
    to_char(b.starts_at at time zone 'America/New_York', 'FMDay, FMMon FMDD "at" FMHH12:MI AM') || ' ET', '/');
end $$;
revoke all on function public.cancel_my_booking(uuid) from public, anon;
grant execute on function public.cancel_my_booking(uuid) to authenticated;

notify pgrst, 'reload schema';

insert into public.reserved_usernames (username) values ('book'), ('graphic-maker'), ('graphicmaker') on conflict do nothing;
