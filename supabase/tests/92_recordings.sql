-- Phase 8 rules: recordings, attendance and feedback.
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
create function tests.rows(stmt text) returns bigint language plpgsql as $$
declare n bigint; begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('lena@example.com','lead'),('max@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
insert into public.calls (id, title, audience, starts_at, duration_minutes, join_url) values
  ('11111111-1111-1111-1111-111111111111', 'Live now', 'leads_open', now() - interval '10 minutes', 60, 'https://zoom.example/live'),
  ('22222222-2222-2222-2222-222222222222', 'Later', 'leads_open', now() + interval '3 days', 60, 'https://zoom.example/later'),
  ('33333333-3333-3333-3333-333333333333', 'Over', 'leads_open', now() - interval '3 hours', 60, 'https://zoom.example/over');

do $$ declare link text; begin
  -- joining records attendance, but only around the call
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  link := public.join_call('11111111-1111-1111-1111-111111111111');
  perform tests.eq('joining a live call returns the link', link, 'https://zoom.example/live');
  perform tests.eq('and records that you came', (select count(*) from public.call_attendance), 1::bigint);
  perform tests.eq('the link is not handed out before the waiting room opens', public.join_call('22222222-2222-2222-2222-222222222222'), null::text);
  perform tests.logout();
  update public.calls set starts_at = now() + interval '9 minutes' where id = '22222222-2222-2222-2222-222222222222';
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('it is handed out 9 minutes before', public.join_call('22222222-2222-2222-2222-222222222222'), 'https://zoom.example/later');
  perform tests.logout();
  update public.calls set starts_at = now() + interval '3 days' where id = '22222222-2222-2222-2222-222222222222';
  delete from public.call_attendance where call_id = '22222222-2222-2222-2222-222222222222';
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('joining three days early records nothing', (select count(*) from public.call_attendance where call_id = '22222222-2222-2222-2222-222222222222'), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform public.join_call('11111111-1111-1111-1111-111111111111');
  perform tests.eq('leads can join open calls', (select count(*) from public.call_attendance), 1::bigint);
  perform tests.logout();

  -- feedback: only for calls you joined, and only once they are over
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('no feedback while the call is still on', format('insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values (%L, auth.uid(), %L, %L, %L)', '11111111-1111-1111-1111-111111111111', 'a', 'b', 'c'), '42501');
  perform tests.logout();
  -- pretend the live call has now ended and Mia was on the Over call as well
  update public.calls set starts_at = now() - interval '2 hours' where id = '11111111-1111-1111-1111-111111111111';
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('an ended call you joined asks for feedback', (select count(*) from public.pending_feedback()), 1::bigint);
  insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'Great', 'The Q&A', 'Follow up fast');
  perform tests.eq('after giving it, no more prompts', (select count(*) from public.pending_feedback()), 0::bigint);
  perform tests.fails('feedback can only be given once', format('insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values (%L, auth.uid(), %L, %L, %L)', '11111111-1111-1111-1111-111111111111', 'a', 'b', 'c'), '23505');
  perform tests.eq('you can read everyone''s feedback after giving yours', (select count(*) from public.call_feedback_all('11111111-1111-1111-1111-111111111111')), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('someone who did not join cannot give feedback', format('insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values (%L, auth.uid(), %L, %L, %L)', '11111111-1111-1111-1111-111111111111', 'a', 'b', 'c'), '42501');
  perform tests.eq('and cannot read others'' feedback', (select count(*) from public.call_feedback_all('11111111-1111-1111-1111-111111111111')), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('admins can read all feedback', (select count(*) from public.call_feedback_all('11111111-1111-1111-1111-111111111111')), 1::bigint);

  -- recordings
  insert into public.recordings (call_id, title, vimeo_id, for_leads, published) values ('11111111-1111-1111-1111-111111111111', 'Community call', '123456789', true, false);
  insert into public.recordings (title, vimeo_id, for_leads, published) values ('Masterclass', '987654321', false, true);
  perform tests.fails('a Vimeo id must be numbers', format('insert into public.recordings (title, vimeo_id) values (%L, %L)', 'x', 'abc'), '23514');
  perform tests.fails('the end must be after the start', format('insert into public.recordings (title, vimeo_id, start_secs, end_secs) values (%L, %L, 100, 50)', 'x', '123456789'), '23514');
  perform tests.eq('an admin sees drafts too', (select count(*) from public.recordings), 2::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('a paying member sees only published ones', (select count(*) from public.recordings), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees none until one is published for leads', (select count(*) from public.recordings), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  update public.recordings set published = true where title = 'Community call';
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('publishing for leads shows it to them', (select count(*) from public.recordings), 1::bigint);
  perform tests.eq('and tells the people who were on that call', (select count(*) from public.notifications where kind = 'recording'), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('people who were not on it are not pinged', (select count(*) from public.notifications where kind = 'recording' and title like '%Community call%'), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.recordings (title, vimeo_id, topics, for_leads, published) values ('Weekly community', '555555555', array['Community calls', 'Strategy'], false, true);
  perform tests.eq('community-call recordings are open to leads automatically', (select for_leads from public.recordings where title = 'Weekly community'), true);
  perform tests.eq('a recording can sit under several topics', (select cardinality(topics) from public.recordings where title = 'Weekly community'), 2);
  perform tests.fails('only the listed topics are accepted', format('insert into public.recordings (title, vimeo_id, topics) values (%L, %L, array[%L])', 'x', '123456789', 'Cooking'), '23514');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads can see it', (select count(*) from public.recordings where title = 'Weekly community'), 1::bigint);
  perform tests.logout();
end $$;
rollback;
