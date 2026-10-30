-- RSVPs become tasks, attendance ticks them off.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
insert into public.calls (id, title, kind, audience, starts_at, duration_minutes) values
  ('00000000-0000-0000-0000-00000000c001', 'Community call', 'community', 'leads_open', now() + interval '2 days', 60),
  ('00000000-0000-0000-0000-00000000c002', 'Masterclass', 'masterclass', 'leads_open', now() + interval '3 days', 60);
insert into public.recordings (id, call_id, title, vimeo_id, published) values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000c002', 'Replay', '123456789', true);

do $$ declare d date := (now() at time zone 'America/New_York')::date;
begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.rsvps (call_id, user_id, mode) values ('00000000-0000-0000-0000-00000000c001', auth.uid(), 'live');
  perform tests.eq('RSVP to live adds a task', (select count(*) from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c001'), 1::bigint);
  perform tests.eq('titled for the call', (select title from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c001'), 'Join live: Community call');
  perform tests.eq('on the day of the call', (select due_on from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c001') between d + 1 and d + 3, true);
  perform tests.logout();

  -- attending ticks it off
  insert into public.call_attendance (call_id, user_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('attending ticks the task off', (select done_on is not null from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c001'), true);

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  -- a replay RSVP: a task the day after, ticked off when 80% is watched
  insert into public.rsvps (call_id, user_id, mode) values ('00000000-0000-0000-0000-00000000c002', auth.uid(), 'recording');
  perform tests.eq('a replay RSVP adds a "Watch the replay" task', (select title from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c002'), 'Watch the replay: Masterclass');
  perform public.record_view('00000000-0000-0000-0000-00000000d002', 40);
  perform tests.eq('a part-watched replay is not ticked off', (select done_on is null from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c002'), true);
  perform public.record_view('00000000-0000-0000-0000-00000000d002', 90);
  perform tests.eq('a watched replay is', (select done_on is not null from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c002'), true);

  -- taking an RSVP back removes a task that is not done
  update public.rsvps set mode = 'live' where call_id = '00000000-0000-0000-0000-00000000c002';
  perform tests.eq('changing to live swaps the task and resets it', (select title || ' / ' || (done_on is null)::text from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c002'), 'Join live: Masterclass / true');
  delete from public.rsvps where call_id = '00000000-0000-0000-0000-00000000c002';
  perform tests.eq('un-RSVP removes the task', (select count(*) from public.tasks where source_call_id = '00000000-0000-0000-0000-00000000c002'), 0::bigint);
  perform tests.logout();

  -- leads have no to-do list
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  insert into public.rsvps (call_id, user_id, mode) values ('00000000-0000-0000-0000-00000000c001', auth.uid(), 'live');
  perform tests.logout();
  perform tests.eq('call tasks do not trigger task reminders', public.queue_task_reminders(), 0);
  perform tests.eq('a lead gets no task', (select count(*) from public.tasks where user_id = '00000000-0000-0000-0000-0000000000a3'), 0::bigint);
end $$;
rollback;
