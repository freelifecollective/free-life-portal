-- Phase 3 rules: invite-only sign-up, calls and who sees them, RSVPs, lead registration, outbox.
begin;
create schema tests;

create function tests.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', r, true);
  execute format('set local role %I', r);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end $$;
create function tests.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;
create function tests.fails(label text, stmt text, want_state text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = want_state then raise notice 'ok   % (%)', label, sqlstate; return; end if;
    raise exception 'FAIL % : expected %, got % (%)', label, want_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL % : statement succeeded but should have failed', label;
end $$;
create function tests.rows(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------- invite-only sign-up
select tests.fails('an uninvited email cannot create an account', $q$insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@example.com')$q$, 'P0001');
insert into public.signup_allowlist (email, role) values ('Lead1@Example.com', 'lead'), ('member1@example.com', 'member'), ('admin1@example.com', 'member');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'lead1@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'MEMBER1@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'admin1@example.com');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
select tests.eq('an invited email can sign up (case does not matter)', (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1')), 2::bigint);
select tests.eq('the invite decides the starting role', (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'member');
select tests.eq('an invite is marked used', (select count(*) from public.signup_allowlist where claimed_at is not null), 3::bigint);
select tests.eq('email is copied to the private profile row', (select email::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'lead1@example.com');
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-0000000000d1', null, true);
select tests.eq('anonymous visitors can still be created (testing only)', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1::bigint);
select tests.fails('an admin cannot be created through an invite', $q$insert into public.signup_allowlist (email, role) values ('x@example.com', 'admin')$q$, '23514');

-- ---------------------------------------------------------------- the invite list
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  perform tests.eq('members cannot read the invite list', (select count(*) from public.signup_allowlist), 0::bigint);
  perform tests.fails('members cannot add invites', $q$insert into public.signup_allowlist (email) values ('friend@example.com')$q$, '42501');
  perform tests.login('00000000-0000-0000-0000-0000000000c1');
  perform tests.eq('admins can read the invite list', (select count(*) from public.signup_allowlist), 3::bigint);
  insert into public.signup_allowlist (email, role, note) values ('newperson@example.com', 'member', 'invited by admin');
  perform tests.eq('admins can invite someone', (select count(*) from public.signup_allowlist where email = 'newperson@example.com'), 1::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- calls and who sees them
insert into public.calls (id, title, kind, audience, starts_at) values
  ('11111111-1111-1111-1111-111111111111', 'Community call', 'community', 'leads_open', now() + interval '3 days'),
  ('22222222-2222-2222-2222-222222222222', 'Masterclass', 'masterclass', 'affiliates_only', now() + interval '5 days'),
  ('33333333-3333-3333-3333-333333333333', 'Old community call', 'community', 'leads_open', now() - interval '10 days');
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a lead sees only leads-open calls', (select string_agg(title, ',' order by title) from public.calls), 'Community call,Old community call');
  perform tests.fails('a lead cannot create a call', $q$insert into public.calls (title, starts_at) values ('Nope', now())$q$, '42501');
  perform tests.eq('a lead cannot edit a call', tests.rows($q$update public.calls set title = 'Hacked'$q$), 0::bigint);
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  perform tests.eq('a member sees every call', (select count(*) from public.calls), 3::bigint);
  perform tests.fails('a member cannot create a call', $q$insert into public.calls (title, starts_at) values ('Nope', now())$q$, '42501');
  perform tests.login('00000000-0000-0000-0000-0000000000c1');
  insert into public.calls (title, starts_at, duration_minutes, join_url) values ('Admin call', now() + interval '1 day', 90, 'https://zoom.us/j/1');
  perform tests.eq('an admin can create a call', (select count(*) from public.calls where title = 'Admin call'), 1::bigint);
  perform tests.fails('a call must run at least 15 minutes', $q$insert into public.calls (title, starts_at, duration_minutes) values ('Short', now(), 5)$q$, '23514');
  perform tests.fails('the join link must be https', $q$insert into public.calls (title, starts_at, join_url) values ('Bad link', now(), 'http://example.com')$q$, '23514');
  perform tests.fails('a call needs a title', $q$insert into public.calls (title, starts_at) values ('   ', now())$q$, '23514');
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('anonymous visitors see no calls directly', (select count(*) from public.calls), 0::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- RSVPs
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.rsvps (call_id, user_id, mode) values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'live');
  perform tests.eq('a lead can RSVP to a leads-open call', (select count(*) from public.rsvps), 1::bigint);
  perform tests.fails('a lead cannot RSVP to an affiliates-only call', $q$insert into public.rsvps (call_id, user_id, mode) values ('22222222-2222-2222-2222-222222222222', auth.uid(), 'live')$q$, '42501');
  perform tests.fails('nobody can RSVP for someone else', $q$insert into public.rsvps (call_id, user_id, mode) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000b1', 'live')$q$, '42501');
  update public.rsvps set mode = 'recording' where user_id = auth.uid();
  perform tests.eq('an RSVP can be changed to the recording', (select mode::text from public.rsvps where user_id = auth.uid()), 'recording');
  perform tests.fails('one RSVP per person per call', $q$insert into public.rsvps (call_id, user_id, mode) values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'live')$q$, '23505');
  perform tests.logout();
end $$;
-- member-side fixtures: onboard a few profiles so they show as picture bubbles
update public.profiles set first_name = 'Mia', last_name = 'Lead', username = 'mialead', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name = 'Max', last_name = 'Member', username = 'maxmember', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000b1';
do $$ declare s jsonb; begin
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  insert into public.rsvps (call_id, user_id, mode) values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'live');
  insert into public.rsvps (call_id, user_id, mode) values ('22222222-2222-2222-2222-222222222222', auth.uid(), 'live');
  s := public.call_rsvp_summary('11111111-1111-1111-1111-111111111111');
  perform tests.eq('summary counts live', (s->>'live')::int, 1);
  perform tests.eq('summary counts recording', (s->>'recording')::int, 1);
  perform tests.eq('summary knows my answer', s->>'mine', 'live');
  perform tests.eq('summary lists people for the bubbles', jsonb_array_length(s->'people'), 2);
  perform tests.eq('summary respects the limit', jsonb_array_length((public.call_rsvp_summary('11111111-1111-1111-1111-111111111111', 1))->'people'), 1);
  perform tests.eq('summary shares no email', (s->'people'->0) ? 'email', false);
  perform tests.eq('a member cannot read other people''s RSVP rows', (select count(*) from public.rsvps), 2::bigint);
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a lead gets nothing for an affiliates-only call', public.call_rsvp_summary('22222222-2222-2222-2222-222222222222') is null, true);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.fails('anonymous visitors cannot see tallies', $q$select public.call_rsvp_summary('11111111-1111-1111-1111-111111111111')$q$, '42501');
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- lead registration (before they have an account)
do $$ declare r jsonb; begin
  perform tests.login(null, 'anon');
  perform tests.eq('anonymous can look up an open upcoming call', (public.public_call('11111111-1111-1111-1111-111111111111'))->>'title', 'Community call');
  perform tests.eq('affiliates-only calls are not public', public.public_call('22222222-2222-2222-2222-222222222222') is null, true);
  perform tests.eq('past calls are not public', public.public_call('33333333-3333-3333-3333-333333333333') is null, true);
  r := public.register_for_call('11111111-1111-1111-1111-111111111111', '  Nora New ', 'Nora.New@Example.com', true);
  perform tests.eq('a lead can register', (r->>'ok')::boolean, true);
  perform tests.eq('same answer when registering again', ((public.register_for_call('11111111-1111-1111-1111-111111111111', 'Nora New', 'nora.new@example.com', true))->>'ok')::boolean, true);
  perform tests.eq('registration needs a valid name', (public.register_for_call('11111111-1111-1111-1111-111111111111', '', 'a@b.co', true))->>'reason', 'invalid_name');
  perform tests.eq('registration needs a valid email', (public.register_for_call('11111111-1111-1111-1111-111111111111', 'X', 'not-an-email', true))->>'reason', 'invalid_email');
  perform tests.eq('registration needs consent', (public.register_for_call('11111111-1111-1111-1111-111111111111', 'X', 'x@example.com', false))->>'reason', 'consent_required');
  perform tests.eq('cannot register for an affiliates-only call', (public.register_for_call('22222222-2222-2222-2222-222222222222', 'X', 'x@example.com', true))->>'reason', 'call_unavailable');
  perform tests.eq('cannot register for a past call', (public.register_for_call('33333333-3333-3333-3333-333333333333', 'X', 'x@example.com', true))->>'reason', 'call_unavailable');
  perform tests.eq('anonymous cannot read registrations', (select count(*) from public.registrations), 0::bigint);
  perform tests.eq('anonymous cannot read the outbox', (select count(*) from public.email_outbox), 0::bigint);
  perform tests.logout();
end $$;
select tests.eq('one registration was stored (second attempt is a no-op)', (select count(*) from public.registrations where email = 'nora.new@example.com'), 1::bigint);
select tests.eq('the name was trimmed', (select name from public.registrations where email = 'nora.new@example.com'), 'Nora New');
select tests.eq('one confirmation email is waiting, not two', (select count(*) from public.email_outbox where to_email = 'nora.new@example.com'), 1::bigint);
select tests.eq('registering puts the email on the invite list as a lead', (select role::text from public.signup_allowlist where email = 'nora.new@example.com'), 'lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'nora.new@example.com');
select tests.eq('the registered lead can now create an account', (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'lead');
select tests.eq('the registration is linked to the new account', (select claimed_by::text from public.registrations where email = 'nora.new@example.com'), '00000000-0000-0000-0000-0000000000e1');

-- ---------------------------------------------------------------- admin-only data
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  perform tests.eq('members cannot read registrations', (select count(*) from public.registrations), 0::bigint);
  perform tests.eq('members cannot read the outbox', (select count(*) from public.email_outbox), 0::bigint);
  perform tests.fails('a member cannot change their own email', $q$update public.profiles set email = 'other@example.com' where id = auth.uid()$q$, '42501');
  perform tests.login('00000000-0000-0000-0000-0000000000c1');
  perform tests.eq('admins can read registrations', (select count(*) from public.registrations), 1::bigint);
  perform tests.eq('admins can read the outbox', (select count(*) from public.email_outbox), 1::bigint);
  perform tests.eq('admins can read member emails', (select email::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'member1@example.com');
  perform tests.logout();
end $$;
select tests.eq('profile cards still expose no email', (select count(*) from information_schema.columns where table_name = 'profile_cards' and column_name = 'email'), 0::bigint);

rollback;
