-- Phase 5g rules: notifications.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('max@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
insert into public.calls (id, title, audience, starts_at) values ('11111111-1111-1111-1111-111111111111', 'Open call', 'leads_open', now() + interval '3 days'),
  ('22222222-2222-2222-2222-222222222222', 'Soon call', 'affiliates_only', now() + interval '55 minutes');

-- a lead registering through Mia's page notifies Mia
do $$ begin
  perform tests.login(null, 'anon');
  perform public.register_for_call('11111111-1111-1111-1111-111111111111', 'Pat', 'Lead', 'pat@example.com', true, 'miamember');
  perform public.register_for_call('11111111-1111-1111-1111-111111111111', 'Sam', 'Nobody', 'sam@example.com', true, null);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the referrer gets a new-lead notification', (select count(*) from public.notifications where kind = 'new_lead'), 1::bigint);
  perform tests.eq('it names the lead', (select body like 'Pat Lead%' from public.notifications where kind = 'new_lead'), true);
  perform tests.eq('marking it read works', tests.rows('update public.notifications set read_at = now()'), 1::bigint);
  perform tests.fails('the message itself cannot be edited', 'update public.notifications set title = ''hacked''', '42501');
  perform tests.fails('people cannot create notifications', format('insert into public.notifications (user_id, kind, title) values (auth.uid(), %L, %L)', 'announcement', 'x'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('others do not see it', (select count(*) from public.notifications), 0::bigint);
  perform tests.logout();
end $$;

-- announcements reach everyone with a finished profile
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('members cannot post announcements', format('insert into public.announcements (title) values (%L)', 'Hi'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.announcements (title, body, url) values ('New: Outsourcing', 'Find help', '/');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead gets the announcement too', (select count(*) from public.notifications where kind = 'announcement'), 1::bigint);
  perform tests.logout();
end $$;

-- call reminders: once per person per reminder
do $$ declare n integer; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  insert into public.rsvps (call_id, user_id, mode) values ('22222222-2222-2222-2222-222222222222', auth.uid(), 'live');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.rsvps (call_id, user_id, mode) values ('22222222-2222-2222-2222-222222222222', auth.uid(), 'recording');
  perform tests.logout();
  n := public.queue_call_reminders();
  perform tests.eq('one reminder goes to the person coming live', n, 1);
  perform tests.eq('asking again does not send it twice', public.queue_call_reminders(), 0);
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('watching the recording means no reminder', (select count(*) from public.notifications where kind = 'call_reminder'), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('members cannot trigger reminders', 'select public.queue_call_reminders()', '42501');
  perform tests.logout();
end $$;

-- a reviewed submission tells the person
do $$ declare fid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.financing_options (title, description, submitted_by) values ('Credit union loan', 'x', auth.uid()) returning id into fid;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  update public.financing_options set status = 'approved' where id = fid;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('approval is announced to the submitter', (select count(*) from public.notifications where kind = 'submission_result'), 1::bigint);
  perform tests.logout();
end $$;

-- push subscriptions are private
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://push.example/abc', 'k', 'a');
  perform tests.fails('nobody saves a subscription for someone else', format('insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (%L, %L, %L, %L)', '00000000-0000-0000-0000-0000000000a5', 'https://push.example/zzz', 'k', 'a'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('others cannot see it', (select count(*) from public.push_subscriptions), 0::bigint);
  perform tests.logout();
end $$;
rollback;
