-- Phase 5h rules: Important Updates, views, audit and undo.
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

-- Hiring a call closer
update public.profiles set call_closer = true where id = '00000000-0000-0000-0000-0000000000a1';
do $$ declare hid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  hid := public.hire_closer('00000000-0000-0000-0000-0000000000a1', 2, 'be kind');
  perform tests.fails('only one closer at a time', $q$ select public.hire_closer('00000000-0000-0000-0000-0000000000a1', null) $q$, '23505');
  perform tests.eq('I can see my hire', (select count(*) from public.closer_hires), 1::bigint);
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'Zed', now() + interval '1 day');
  perform tests.eq('the first call goes to the closer', (select closer_id from public.booked_calls where lead_name = 'Zed'), '00000000-0000-0000-0000-0000000000a1'::uuid);
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'Yan', now() + interval '2 day');
  perform tests.eq('the second call goes to the closer', (select closer_id from public.booked_calls where lead_name = 'Yan'), '00000000-0000-0000-0000-0000000000a1'::uuid);
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'Xi', now() + interval '3 day');
  perform tests.eq('the third call is back with the coach', (select count(*) from public.booked_calls where lead_name = 'Xi' and closer_id is null), 1::bigint);
  perform tests.eq('a two-call hire ends by itself', (select status from public.closer_hires limit 1), 'ended');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the closer was told', (select count(*) from public.notifications where title like '% hired you for two calls'), 1::bigint);
  perform tests.eq('the closer sees who hired them', (select count(*) from public.closer_hires), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  hid := public.hire_closer('00000000-0000-0000-0000-0000000000a1', null);
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'W', now() + interval '4 day'), ('00000000-0000-0000-0000-0000000000a5', 'V', now() + interval '5 day');
  perform tests.eq('an ongoing hire keeps assigning', (select count(*) from public.booked_calls where lead_name in ('W', 'V') and closer_id = '00000000-0000-0000-0000-0000000000a1'), 2::bigint);
  perform public.end_closer_hire(hid);
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'U', now() + interval '6 day');
  perform tests.eq('after ending, calls stay with the coach', (select count(*) from public.booked_calls where lead_name = 'U' and closer_id is null), 1::bigint);
  perform tests.fails('cannot hire someone who is not a closer', $q$ select public.hire_closer('00000000-0000-0000-0000-0000000000a4', 1) $q$, '22023');
  perform tests.fails('cannot hire yourself', $q$ select public.hire_closer('00000000-0000-0000-0000-0000000000a5', 1) $q$, '22023');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('leads cannot hire', $q$ select public.hire_closer('00000000-0000-0000-0000-0000000000a1', 1) $q$, '42501');
  perform tests.logout();
end $$;
rollback;
