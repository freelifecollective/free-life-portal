-- Feedback: allowed after being live or after watching the replay, not before.
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
create function tests.fails(label text, stmt text, want_state text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then
    if sqlstate = want_state then raise notice 'ok   % (%)', label, sqlstate; return; end if;
    raise exception 'FAIL % : expected %, got % (%)', label, want_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL % : statement succeeded but should have failed', label;
end $$;
create function tests.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('ann@example.com','member'),('bob@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a6','ann@example.com'),('00000000-0000-0000-0000-0000000000a7','bob@example.com');
insert into public.calls (id, title, kind, audience, starts_at, duration_minutes) values ('00000000-0000-0000-0000-00000000c001', 'Community call', 'community', 'leads_open', now() - interval '3 hours', 60);
insert into public.recordings (id, call_id, title, vimeo_id, published) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 'Replay', '123456789', true);
insert into public.call_attendance (call_id, user_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1');
insert into public.recording_views (user_id, recording_id, max_pct, completed_at) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-00000000d001', 90, now()),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-00000000d001', 40, null);

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values ('00000000-0000-0000-0000-00000000c001', auth.uid(), 'a', 'b', 'c');
  perform tests.eq('someone who was live can leave feedback', (select count(*) from public.call_feedback), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values ('00000000-0000-0000-0000-00000000c001', auth.uid(), 'a', 'b', 'c');
  perform tests.eq('someone who watched the replay can too', (select count(*) from public.call_feedback), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a6');
  perform tests.fails('a partly watched replay does not count', format('insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values (%L, auth.uid(), ''a'', ''b'', ''c'')', '00000000-0000-0000-0000-00000000c001'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a7');
  perform tests.fails('and neither does doing neither', format('insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values (%L, auth.uid(), ''a'', ''b'', ''c'')', '00000000-0000-0000-0000-00000000c001'), '42501');
  perform tests.logout();
end $$;
rollback;
