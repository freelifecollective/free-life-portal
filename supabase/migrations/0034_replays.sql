-- Replays: how much of a recording someone watched, and badges for watching replays.

alter table public.recording_views
  add column last_viewed_at timestamptz not null default now(),
  add column max_pct integer not null default 0 check (max_pct between 0 and 100),
  add column completed_at timestamptz;   -- set once at least 80% has been watched

-- Called by the player: remembers the furthest point reached (0 to 100) and when it passes 80% marks the replay as watched.
create function public.record_view(p_recording uuid, p_pct integer) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare pct integer := greatest(0, least(coalesce(p_pct, 0), 100));
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.recordings r where r.id = p_recording
      and (public.is_admin() or (r.published and (public.can_see('member') or (r.for_leads and public.app_current_role() = 'lead'))))) then return; end if;
  insert into public.recording_views (user_id, recording_id, max_pct, completed_at)
    values (auth.uid(), p_recording, pct, case when pct >= 80 then now() end)
  on conflict (user_id, recording_id) do update
    set last_viewed_at = now(),
        max_pct = greatest(public.recording_views.max_pct, excluded.max_pct),
        completed_at = coalesce(public.recording_views.completed_at, case when greatest(public.recording_views.max_pct, excluded.max_pct) >= 80 then now() end);
end $$;
revoke all on function public.record_view(uuid, integer) from public, anon;
grant execute on function public.record_view(uuid, integer) to authenticated;

-- Replaces badge_state() from 0033: adds "replays watched" (1, 5, 10, 25, 50, 100), counted when at least 80% was watched.
create or replace function public.badge_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid(); zone text; today date; fam text; n integer; s record;
  fresh text[] := '{}'; streaks jsonb := '{}'::jsonb; comm integer; mast integer; ans integer; coach integer; sales integer; reps integer;
begin
  if me is null or not public.can_see('member') then return null; end if;
  select mp.tz into zone from public.member_prefs mp where mp.member_id = me;
  begin today := (now() at time zone coalesce(zone, 'America/New_York'))::date;
  exception when others then today := (now() at time zone 'America/New_York')::date; end;

  foreach fam in array array['followup', 'morning', 'cleared'] loop
    select * into s from public.streak_of(me, fam, today);
    streaks := streaks || jsonb_build_object(fam, jsonb_build_object('current', s.cur, 'best', s.best));
    foreach n in array array[7, 14, 30, 90, 180, 365] loop
      if s.best >= n and public.give_badge(me, fam || '_' || n) then fresh := fresh || (fam || '_' || n); end if;
    end loop;
  end loop;

  select count(distinct a.call_id)::integer into comm from public.call_attendance a join public.calls k on k.id = a.call_id where a.user_id = me and k.kind = 'community';
  select count(distinct a.call_id)::integer into mast from public.call_attendance a join public.calls k on k.id = a.call_id where a.user_id = me and k.kind = 'masterclass';
  select count(*)::integer into ans from public.chat_comments c join public.chat_posts p on p.id = c.post_id where c.author_id = me and p.author_id <> me;
  select count(*)::integer into coach from public.milestone_events where member_id = me and kind = 'coaching';
  select count(*)::integer into sales from public.milestone_events where member_id = me and kind = 'sale';
  select count(*)::integer into reps from public.recording_views where user_id = me and completed_at is not null;

  foreach n in array array[1, 5, 10, 25, 50, 100] loop
    if comm >= n and public.give_badge(me, 'community_' || n) then fresh := fresh || ('community_' || n); end if;
  end loop;
  foreach n in array array[1, 3, 5, 10, 25] loop
    if mast >= n and public.give_badge(me, 'masterclass_' || n) then fresh := fresh || ('masterclass_' || n); end if;
  end loop;
  foreach n in array array[100, 250, 500, 1000] loop
    if ans >= n and public.give_badge(me, 'answers_' || n) then fresh := fresh || ('answers_' || n); end if;
  end loop;
  foreach n in array array[1, 5, 10, 25, 50, 100] loop
    if reps >= n and public.give_badge(me, 'replays_' || n) then fresh := fresh || ('replays_' || n); end if;
  end loop;
  for n in select x from (select 1 as x union all select g from generate_series(10, coach, 10) g) t where x <= coach loop
    if public.give_badge(me, 'coaching_' || n) then fresh := fresh || ('coaching_' || n); end if;
  end loop;
  for n in select x from (select 1 as x union all select 5 union all select g from generate_series(10, sales, 10) g) t where x <= sales loop
    if public.give_badge(me, 'sales_' || n) then fresh := fresh || ('sales_' || n); end if;
  end loop;

  return jsonb_build_object(
    'streaks', streaks,
    'attended', jsonb_build_object('community', comm, 'masterclass', mast),
    'counts', jsonb_build_object('community', comm, 'masterclass', mast, 'answers', ans, 'coaching', coach, 'sales', sales, 'replays', reps),
    'earned', coalesce((select jsonb_agg(jsonb_build_object('key', b.key, 'at', b.earned_at) order by b.earned_at) from public.badges b where b.user_id = me), '[]'::jsonb),
    'new', to_jsonb(fresh));
end $$;
