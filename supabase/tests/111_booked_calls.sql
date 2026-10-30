-- Calls booked: private to the affiliate, visible to their closer.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('cal@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a6','cal@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.booked_calls (member_id, lead_name, starts_at, closer_id) values (auth.uid(), 'Pat Lead', now() + interval '2 days', '00000000-0000-0000-0000-0000000000a6');
  perform tests.eq('an affiliate can book a call', (select count(*) from public.booked_calls), 1::bigint);
  perform tests.fails('but not for someone else', format('insert into public.booked_calls (member_id, lead_name, starts_at) values (%L, ''x'', now())', '00000000-0000-0000-0000-0000000000a5'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('others cannot see it', (select count(*) from public.booked_calls), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a6');
  perform tests.eq('the closer taking the call can', (select count(*) from public.booked_calls), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('leads cannot book calls', 'insert into public.booked_calls (member_id, lead_name, starts_at) values (auth.uid(), ''x'', now())', '42501');
  perform tests.logout();
end $$;
rollback;
