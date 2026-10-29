-- Preferences: each person can only see and change their own.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com');

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.member_prefs (member_id, quote_style) values (auth.uid(), 'faith');
  perform tests.eq('you can set your own style', (select quote_style from public.member_prefs), 'faith');
  perform tests.fails('only the three styles are allowed', 'update public.member_prefs set quote_style = ''gossip''', '23514');
  perform tests.fails('you cannot set someone elses', format('insert into public.member_prefs (member_id, quote_style) values (%L, %L)', '00000000-0000-0000-0000-0000000000a5', 'faith'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('and nobody else can see it', (select count(*) from public.member_prefs), 0::bigint);
  perform tests.logout();
end $$;
rollback;
