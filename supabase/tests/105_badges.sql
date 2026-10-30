-- Streaks and badges.
begin;
create schema tests;
create function tests.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', r, true);
  execute format('set local role %I', r);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', true); execute 'reset role'; end $$;
create function tests.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
insert into public.calls (id, title, kind, audience, starts_at, duration_minutes) values
  ('00000000-0000-0000-0000-00000000c001', 'Community call', 'community', 'leads_open', now() - interval '3 days', 60),
  ('00000000-0000-0000-0000-00000000c002', 'Masterclass', 'masterclass', 'affiliates_only', now() - interval '2 days', 60);
insert into public.call_attendance (call_id, user_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a1');

do $$
declare d date := (now() at time zone 'America/New_York')::date; i integer; s jsonb; keys text;
begin
  -- Mia followed up for 8 days running ending today, did her morning routine on 3 days ending today, and cleared her list 2 days ago and today
  for i in 0..7 loop insert into public.task_completions (user_id, tag, done_on) values ('00000000-0000-0000-0000-0000000000a1', 'followup', d - i); end loop;
  for i in 0..2 loop insert into public.task_completions (user_id, tag, done_on) values ('00000000-0000-0000-0000-0000000000a1', 'morning', d - i); end loop;
  insert into public.task_clear_days (user_id, day) values ('00000000-0000-0000-0000-0000000000a1', d), ('00000000-0000-0000-0000-0000000000a1', d - 2);
  -- Max's follow-up streak ended three days ago, so it is no longer alive but his best still counts
  for i in 3..11 loop insert into public.task_completions (user_id, tag, done_on) values ('00000000-0000-0000-0000-0000000000a5', 'followup', d - i); end loop;

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  s := public.badge_state();
  perform tests.eq('follow-up streak is 8 and alive', (s->'streaks'->'followup'->>'current')::int, 8);
  perform tests.eq('morning streak is 3', (s->'streaks'->'morning'->>'current')::int, 3);
  perform tests.eq('a gap in cleared days breaks the streak', (s->'streaks'->'cleared'->>'current')::int, 1);
  perform tests.eq('the 7-day follow-up badge is earned and new', (s->'new') ? 'followup_7', true);
  perform tests.eq('the 14-day follow-up badge is not', (s->'new') ? 'followup_14', false);
  perform tests.eq('first community call badge', (s->'new') ? 'community_1', true);
  perform tests.eq('first masterclass badge', (s->'new') ? 'masterclass_1', true);
  perform tests.eq('community 5 not yet', (s->'new') ? 'community_5', false);
  perform tests.eq('a second look finds nothing new', jsonb_array_length(public.badge_state()->'new'), 0);
  perform tests.eq('badges are kept', (select count(*) from public.badges), 3::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  s := public.badge_state();
  perform tests.eq('a streak that ended is no longer current', (s->'streaks'->'followup'->>'current')::int, 0);
  perform tests.eq('but the best is 9', (s->'streaks'->'followup'->>'best')::int, 9);
  perform tests.eq('and the badge was earned', (s->'new') ? 'followup_7', true);
  perform tests.eq('nobody sees the other person''s badges', (select count(*) from public.badges where user_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads get no badge state', public.badge_state() is null, true);
  perform tests.logout();
end $$;
rollback;
