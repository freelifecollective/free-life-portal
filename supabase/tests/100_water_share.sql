-- Water Share Map rules.
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
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
insert into public.member_private (member_id, rank_id) values ('00000000-0000-0000-0000-0000000000a1', 4);

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.water_share (member_id, lat, lng, place, prefilter, water_type) values (auth.uid(), -27.47, 153.02, 'Brisbane, Queensland, Australia', true, 'city');
  perform tests.fails('you cannot add someone else', format('insert into public.water_share values (%L, 1, 1, %L, false, %L)', '00000000-0000-0000-0000-0000000000a5', 'x', 'well'), '42501');
  perform tests.fails('latitude must be real', format('insert into public.water_share (member_id, lat, lng, place, prefilter, water_type) values (%L, 95, 1, %L, false, %L)', '00000000-0000-0000-0000-0000000000a5', 'x', 'well'), '42501');
  perform tests.fails('water type is city or well', 'update public.water_share set water_type = ''rain''', '23514');
  perform tests.eq('the map shows rank', (select rank from public.water_share_map()), '4A');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads see nobody on the map', (select count(*) from public.water_share_map()), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('another affiliate sees the dot', (select count(*) from public.water_share_map()), 1::bigint);
  perform tests.eq('but cannot read the table directly', (select count(*) from public.water_share), 0::bigint);
  perform tests.logout();

  update public.profiles set unpaid_since = (current_date - interval '5 months')::date where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('five unpaid months: still on the map', (select count(*) from public.water_share_map()), 1::bigint);
  perform tests.logout();
  update public.profiles set unpaid_since = (current_date - interval '7 months')::date where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('six unpaid months: off the map', (select count(*) from public.water_share_map()), 0::bigint);
  perform tests.logout();
  update public.profiles set unpaid_since = null, removed_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('removed members are off the map', (select count(*) from public.water_share_map()), 0::bigint);
  perform tests.logout();
end $$;
rollback;
