-- "Don't ask me again" hides a call from the feedback popup, only for that person.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com');
insert into public.calls (id, title, kind, audience, starts_at, duration_minutes)
  values ('00000000-0000-0000-0000-00000000c001', 'Community call', 'community', 'leads_open', now() - interval '3 hours', 60);
insert into public.call_attendance (call_id, user_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5');

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the call is waiting for feedback', (select count(*) from public.pending_feedback()), 1::bigint);
  insert into public.feedback_dismissed (user_id, call_id) values (auth.uid(), '00000000-0000-0000-0000-00000000c001');
  perform tests.eq('after "don''t ask again" it is gone', (select count(*) from public.pending_feedback()), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('but others are still asked', (select count(*) from public.pending_feedback()), 1::bigint);
  perform tests.logout();
end $$;
rollback;
