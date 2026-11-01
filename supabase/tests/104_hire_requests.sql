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

update public.profiles set call_closer = true where id = '00000000-0000-0000-0000-0000000000a1';
do $$ declare hid uuid; hid2 uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  hid := public.hire_closer('00000000-0000-0000-0000-0000000000a1', 1, 'please');
  perform tests.eq('a new hire waits for the closer', (select status from public.closer_hires where id = hid), 'pending');
  perform tests.fails('a waiting request still blocks a second hire', $q$ select public.hire_closer('00000000-0000-0000-0000-0000000000a1', null) $q$, '23505');
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'Early', now() + interval '1 day');
  perform tests.eq('calls do not go to a closer who has not accepted', (select count(*) from public.booked_calls where lead_name = 'Early' and closer_id is null), 1::bigint);
  perform tests.fails('I cannot accept my own request', format('select public.respond_closer_hire(%L, true)', hid), 'P0002');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the closer was asked', (select count(*) from public.notifications where title like '% wants to hire you for one call'), 1::bigint);
  perform public.respond_closer_hire(hid, true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the member was told', (select count(*) from public.notifications where title like '% accepted your hire'), 1::bigint);
  insert into public.booked_calls (member_id, lead_name, starts_at) values ('00000000-0000-0000-0000-0000000000a5', 'Later', now() + interval '2 day');
  perform tests.eq('after accepting, the call goes to the closer', (select count(*) from public.booked_calls where lead_name = 'Later' and closer_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint);
  perform tests.eq('a one-call hire is used up', (select status from public.closer_hires where id = hid), 'ended');
  hid2 := public.hire_closer('00000000-0000-0000-0000-0000000000a1', null);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.respond_closer_hire(hid2, false, 'fully booked');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('a declined request is marked declined', (select status from public.closer_hires where id = hid2), 'declined');
  perform tests.eq('the decline note reaches the member', (select count(*) from public.notifications where title like '% cannot take your calls right now' and body = 'fully booked'), 1::bigint);
  hid2 := public.hire_closer('00000000-0000-0000-0000-0000000000a1', null);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.respond_closer_hire(hid2, true);
  perform public.end_closer_hire(hid2);
  perform tests.eq('the closer can stop a hire', (select status from public.closer_hires where id = hid2), 'ended');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the member was told it stopped', (select count(*) from public.notifications where title like '% has stopped taking your calls'), 1::bigint);
  perform tests.logout();
end $$;
rollback;
