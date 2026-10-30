-- Tasks: privacy, ordering fields and reminders.
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
create function tests.fails(label text, stmt text, want_state text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then
    if sqlstate = want_state then raise notice 'ok   % (%)', label, sqlstate; return; end if;
    raise exception 'FAIL % : expected %, got % (%)', label, want_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL % : statement succeeded but should have failed', label;
end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';

do $$
declare h integer := extract(hour from now() at time zone 'UTC')::integer; o integer; zone text; d date;
begin
  -- pick a time zone where it is about midday right now, so the reminder hours are met whatever time the test runs
  o := ((12 - h + 11) % 24) - 11;
  zone := case when o = 0 then 'Etc/GMT' when o > 0 then 'Etc/GMT-' || o else 'Etc/GMT+' || (-o) end;
  insert into public.member_prefs (member_id, tz) values ('00000000-0000-0000-0000-0000000000a1', zone);
  d := (now() at time zone zone)::date;

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.tasks (user_id, area, title, repeat, due_on) values
    (auth.uid(), 'business', 'Send the follow-ups', 'once', d + 1),
    (auth.uid(), 'personal', 'Book the dentist', 'once', d),
    (auth.uid(), 'business', 'Pay the ad bill', 'monthly', d - 2),
    (auth.uid(), 'business', 'Morning outreach', 'daily', null),
    (auth.uid(), 'personal', 'Far away', 'weekly', d + 10);
  perform tests.fails('a repeating task needs a due date', 'insert into public.tasks (user_id, title, repeat) values (auth.uid(), ''x'', ''weekly'')', '23514');
  perform tests.fails('only the listed repeats are allowed', 'insert into public.tasks (user_id, title, repeat) values (auth.uid(), ''x'', ''hourly'')', '23514');
  perform tests.fails('you cannot add tasks for someone else', format('insert into public.tasks (user_id, title) values (%L, ''x'')', '00000000-0000-0000-0000-0000000000a5'), '42501');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('leads cannot add tasks', 'insert into public.tasks (user_id, title) values (auth.uid(), ''x'')', '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('nobody else can see them', (select count(*) from public.tasks), 0::bigint);
  perform tests.logout();

  perform tests.eq('first run sends three reminders (tomorrow, today, overdue)', public.queue_task_reminders(), 3);
  perform tests.eq('and nothing again straight after', public.queue_task_reminders(), 0);
  perform tests.eq('daily and far-off tasks send none', (select count(*) from public.notifications where kind = 'task' and title like '%Morning%' or title like '%Far away%'), 0::bigint);
  perform tests.eq('the titles say what is due', (select string_agg(split_part(title, ':', 1), ',' order by title) from public.notifications where kind = 'task'), 'Due today,Due tomorrow,Overdue');

  -- ticking off and moving the date resets the overdue count
  update public.tasks set due_on = d + 30, done_on = d where title = 'Pay the ad bill';
  perform tests.eq('a moved due date clears the overdue count', (select overdue_nudges from public.tasks where title = 'Pay the ad bill'), 0);
  perform tests.eq('a task ticked off for this round sends nothing', public.queue_task_reminders(), 0);
end $$;
rollback;
