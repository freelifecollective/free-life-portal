-- Call closer details: affiliates read, admins write.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('max@example.com','member'),('lena@example.com','lead'),('liz@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a6','liz@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Liz', last_name='Z', username='lizlead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  update public.profiles set call_closer = true where id = '00000000-0000-0000-0000-0000000000a5';
  insert into public.call_closer_details (member_id, calls_taken, closer_since, close_rate, price_per_call_cents, price_per_sale) values ('00000000-0000-0000-0000-0000000000a5', '120+', '2024-01-15', 38.5, 5000, E'1A-3A = $50\n4A+ = 8% of total sales commission');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('an affiliate can read a closer''s details', (select calls_taken from public.call_closer_details where member_id = '00000000-0000-0000-0000-0000000000a5'), '120+');
  perform tests.eq('an update by an affiliate changes nothing', tests.rows($q$update public.call_closer_details set calls_taken = 999 where member_id = '00000000-0000-0000-0000-0000000000a5'$q$), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees none', (select count(*) from public.call_closer_details), 0::bigint);
  perform tests.logout();
end $$;
rollback;
