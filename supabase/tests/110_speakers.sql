-- Speakers on calls, and the attendance summary.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
insert into public.calls (id, title, kind, audience, starts_at, duration_minutes) values
  ('00000000-0000-0000-0000-00000000c001', 'Open call', 'community', 'leads_open', now() + interval '1 day', 60),
  ('00000000-0000-0000-0000-00000000c002', 'Members call', 'masterclass', 'affiliates_only', now() + interval '2 days', 60);
insert into public.call_attendance (call_id, user_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1');

do $$ declare s jsonb; pc jsonb;
begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.call_speakers (call_id, name, photo_url, position) values
    ('00000000-0000-0000-0000-00000000c001', 'Sonya', 'https://x.test/a.jpg', 0), ('00000000-0000-0000-0000-00000000c001', 'Lacey', null, 1),
    ('00000000-0000-0000-0000-00000000c002', 'Guest', null, 0);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('members see the speakers', (select count(*) from public.call_speakers), 3::bigint);
  perform tests.fails('members cannot add speakers', format('insert into public.call_speakers (call_id, name) values (%L, ''x'')', '00000000-0000-0000-0000-00000000c001'), '42501');
  s := public.call_attendance_summary('00000000-0000-0000-0000-00000000c001');
  perform tests.eq('one person attended', (s->>'count')::int, 1);
  perform tests.eq('with their name', s->'people'->0->>'name', 'Mia');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads see only the speakers of calls open to them', (select count(*) from public.call_speakers), 2::bigint);
  perform tests.eq('and cannot see attendance of a members call', public.call_attendance_summary('00000000-0000-0000-0000-00000000c002') is null, true);
  perform tests.logout();

  pc := public.next_public_call();
  perform tests.eq('the public call lists its speakers', jsonb_array_length(pc->'speakers'), 2);
  perform tests.eq('in order', pc->'speakers'->0->>'name', 'Sonya');
end $$;
rollback;
