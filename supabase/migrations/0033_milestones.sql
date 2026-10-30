-- More badges: answering questions in chats, coaching calls and sales. Coaching calls and sales are logged by an admin.

create table public.milestone_events (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('coaching', 'sale')),
  happened_on date not null default current_date,
  note        text check (note is null or char_length(note) <= 200),
  logged_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index milestone_events_idx on public.milestone_events (member_id, kind);
alter table public.milestone_events enable row level security;
create policy me_read on public.milestone_events for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy me_admin_write on public.milestone_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- hands out one badge; true when it is new
create function public.give_badge(p_user uuid, p_key text) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c integer;
begin
  insert into public.badges (user_id, key) values (p_user, p_key) on conflict do nothing;
  get diagnostics c = row_count;
  return c > 0;
end $$;
revoke all on function public.give_badge(uuid, text) from public, anon, authenticated;

-- Replaces badge_state() from 0032 with the new badges.
-- Streaks: 7, 14, 30, 90, 180, 365 days. Community calls: 1, 5, 10, 25, 50, 100. Masterclasses: 1, 3, 5, 10, 25.
-- Questions answered in chats: 100, 250, 500, 1000. Coaching calls: 1, then every 10 (10, 20, 30 and on). Sales: 1, 5, then every 10.
create or replace function public.badge_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid(); zone text; today date; fam text; n integer; s record;
  fresh text[] := '{}'; streaks jsonb := '{}'::jsonb; comm integer; mast integer; ans integer; coach integer; sales integer;
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

  foreach n in array array[1, 5, 10, 25, 50, 100] loop
    if comm >= n and public.give_badge(me, 'community_' || n) then fresh := fresh || ('community_' || n); end if;
  end loop;
  foreach n in array array[1, 3, 5, 10, 25] loop
    if mast >= n and public.give_badge(me, 'masterclass_' || n) then fresh := fresh || ('masterclass_' || n); end if;
  end loop;
  foreach n in array array[100, 250, 500, 1000] loop
    if ans >= n and public.give_badge(me, 'answers_' || n) then fresh := fresh || ('answers_' || n); end if;
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
    'counts', jsonb_build_object('community', comm, 'masterclass', mast, 'answers', ans, 'coaching', coach, 'sales', sales),
    'earned', coalesce((select jsonb_agg(jsonb_build_object('key', b.key, 'at', b.earned_at) order by b.earned_at) from public.badges b where b.user_id = me), '[]'::jsonb),
    'new', to_jsonb(fresh));
end $$;
