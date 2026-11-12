-- Automations: a form sign-up lines up the owner's emails and texts, at the right times.
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


insert into public.signup_allowlist (email, role) values ('bo@example.com','member'),('sam@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1','bo@example.com'),('00000000-0000-0000-0000-0000000000c2','sam@example.com');
update public.profiles set first_name='Bo', last_name='B', username='bobuilder', onboarded_at=now(), plan=97 where id='00000000-0000-0000-0000-0000000000b1';
update public.profiles set first_name='Sam', last_name='S', username='samstarter', onboarded_at=now(), plan=47 where id='00000000-0000-0000-0000-0000000000c2';

do $$ declare bo uuid := '00000000-0000-0000-0000-0000000000b1'; sam uuid := '00000000-0000-0000-0000-0000000000c2';
  f uuid; s1 uuid; em uuid; tx uuid;
begin
  perform tests.login(sam);
  perform tests.fails('Starter cannot write messages', format('insert into public.member_messages (owner_id, kind, name, subject, body) values (%L, %L, %L, %L, %L)', sam, 'email', 'Hi', 'Hi', 'Hello'), '42501');
  perform tests.logout();

  perform tests.login(bo);
  insert into public.funnels (owner_id, name, slug) values (bo, 'Guide', 'guide') returning id into f;
  insert into public.funnel_steps (funnel_id, position, name, slug) values (f, 0, 'Opt-in', 'optin') returning id into s1;
  insert into public.member_messages (owner_id, kind, name, subject, body) values (bo, 'email', 'Welcome', 'Welcome, {first_name}!', 'Hi {first_name}, here is your guide.') returning id into em;
  insert into public.member_messages (owner_id, kind, name, body) values (bo, 'text', 'Nudge', 'Hi {first_name}, did you get my email?') returning id into tx;
  perform tests.fails('an email needs a subject', format('insert into public.member_messages (owner_id, kind, name, body) values (%L, %L, %L, %L)', bo, 'email', 'x', 'y'), '23514');
  perform tests.fails('steps must be well formed', format('insert into public.automations (owner_id, name, steps) values (%L, %L, %L)', bo, 'Bad', '[{"wait_hours":"soon"}]'), '23514');
  insert into public.automations (owner_id, name, funnel_id, steps) values (bo, 'Welcome series', f, jsonb_build_array(jsonb_build_object('wait_hours', 0, 'message_id', em), jsonb_build_object('wait_hours', 24, 'message_id', tx)));
  perform tests.logout();

  perform public.submit_funnel_form(f, s1, '{"first_name":"Lee","email":"lee@example.com","phone":"+1 555 123 4567"}');
  perform tests.eq('the welcome email is lined up', (select payload ->> 'subject' from public.email_outbox where to_email = 'lee@example.com' and template = 'member_message'), 'Welcome, Lee!');
  perform tests.eq('right away', (select send_after <= now() + interval '1 minute' from public.email_outbox where to_email = 'lee@example.com'), true);
  perform tests.eq('the text waits a day', (select send_after > now() + interval '23 hours' from public.sms_outbox where to_phone = '+1 555 123 4567'), true);
  perform tests.eq('and says their name', (select body from public.sms_outbox where to_phone = '+1 555 123 4567'), 'Hi Lee, did you get my email?');

  perform public.submit_funnel_form(f, s1, '{"first_name":"Kim","email":"kim@example.com"}');
  perform tests.eq('no phone, no text', (select count(*) from public.sms_outbox where owner_id = bo), 1::bigint);

  perform tests.login(sam);
  perform tests.eq('others cannot see someone''s texts', (select count(*) from public.sms_outbox), 0::bigint);
  perform tests.logout();
end $$;
rollback;
