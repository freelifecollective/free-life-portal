-- Streaks and badges: what was ticked off each day, which days the whole list was cleared, and the badges earned.

create table public.task_completions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete set null,
  tag        text check (tag in ('followup', 'morning')),
  done_on    date not null,
  created_at timestamptz not null default now()
);
create index task_completions_idx on public.task_completions (user_id, tag, done_on);
alter table public.task_completions enable row level security;
create policy tc_read on public.task_completions for select to authenticated using (user_id = auth.uid());
create policy tc_insert on public.task_completions for insert to authenticated with check (user_id = auth.uid() and public.can_see('member'));
create policy tc_delete on public.task_completions for delete to authenticated using (user_id = auth.uid());

create table public.task_clear_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
alter table public.task_clear_days enable row level security;
create policy tcd_read on public.task_clear_days for select to authenticated using (user_id = auth.uid());
create policy tcd_insert on public.task_clear_days for insert to authenticated with check (user_id = auth.uid() and public.can_see('member'));
create policy tcd_delete on public.task_clear_days for delete to authenticated using (user_id = auth.uid());

create table public.badges (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  key       text not null check (key ~ '^[a-z]+_[0-9]+$'),
  earned_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.badges enable row level security;
create policy badges_read on public.badges for select to authenticated using (user_id = auth.uid());
-- badges are only ever handed out by badge_state() below

-- Days in a row, for one kind of streak: how many it is right now (still alive if the last day was today or yesterday), and the best ever.
create function public.streak_of(p_user uuid, p_kind text, p_today date) returns table (cur integer, best integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  with d as (
    select distinct done_on as day from public.task_completions where user_id = p_user and p_kind in ('followup', 'morning') and tag = p_kind
    union
    select day from public.task_clear_days where user_id = p_user and p_kind = 'cleared'),
  g as (select day, day - (row_number() over (order by day))::integer as grp from d),
  isl as (select max(day) as e, count(*)::integer as n from g group by grp)
  select coalesce((select n from isl where e >= p_today - 1 and e <= p_today order by e desc limit 1), 0),
         coalesce((select max(n) from isl), 0)
$$;
revoke all on function public.streak_of(uuid, text, date) from public, anon, authenticated;

-- Hands out any badges that have been reached and returns the whole picture: streaks, calls attended, badges earned, and which are new.
-- Streak badges: 7, 14, 30, 90, 180, 365 days in a row. Community calls attended: 1, 5, 10, 25, 50, 100. Masterclasses: 1, 3, 5, 10, 25.
create function public.badge_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid(); zone text; today date; fam text; n integer; c integer; s record;
  fresh text[] := '{}'; streaks jsonb := '{}'::jsonb; comm integer; mast integer;
begin
  if me is null or not public.can_see('member') then return null; end if;
  select mp.tz into zone from public.member_prefs mp where mp.member_id = me;
  begin today := (now() at time zone coalesce(zone, 'America/New_York'))::date;
  exception when others then today := (now() at time zone 'America/New_York')::date; end;

  foreach fam in array array['followup', 'morning', 'cleared'] loop
    select * into s from public.streak_of(me, fam, today);
    streaks := streaks || jsonb_build_object(fam, jsonb_build_object('current', s.cur, 'best', s.best));
    foreach n in array array[7, 14, 30, 90, 180, 365] loop
      if s.best >= n then
        insert into public.badges (user_id, key) values (me, fam || '_' || n) on conflict do nothing;
        get diagnostics c = row_count;
        if c > 0 then fresh := fresh || (fam || '_' || n); end if;
      end if;
    end loop;
  end loop;

  select count(distinct a.call_id)::integer into comm from public.call_attendance a join public.calls k on k.id = a.call_id where a.user_id = me and k.kind = 'community';
  select count(distinct a.call_id)::integer into mast from public.call_attendance a join public.calls k on k.id = a.call_id where a.user_id = me and k.kind = 'masterclass';
  foreach n in array array[1, 5, 10, 25, 50, 100] loop
    if comm >= n then
      insert into public.badges (user_id, key) values (me, 'community_' || n) on conflict do nothing;
      get diagnostics c = row_count;
      if c > 0 then fresh := fresh || ('community_' || n); end if;
    end if;
  end loop;
  foreach n in array array[1, 3, 5, 10, 25] loop
    if mast >= n then
      insert into public.badges (user_id, key) values (me, 'masterclass_' || n) on conflict do nothing;
      get diagnostics c = row_count;
      if c > 0 then fresh := fresh || ('masterclass_' || n); end if;
    end if;
  end loop;

  return jsonb_build_object(
    'streaks', streaks,
    'attended', jsonb_build_object('community', comm, 'masterclass', mast),
    'earned', coalesce((select jsonb_agg(jsonb_build_object('key', b.key, 'at', b.earned_at) order by b.earned_at) from public.badges b where b.user_id = me), '[]'::jsonb),
    'new', to_jsonb(fresh));
end $$;
revoke all on function public.badge_state() from public, anon;
grant execute on function public.badge_state() to authenticated;
