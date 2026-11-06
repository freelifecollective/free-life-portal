-- Phase 237: call closers set the languages they take calls in.
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
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now(), call_closer=true where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.save_my_closer_languages('Spanish', array['English', 'French', 'Spanish', 'English']);
  perform tests.eq('the native language is kept', (select native_language from public.call_closers_directory() limit 1), 'Spanish');
  perform tests.eq('the other languages are listed once, without the native one', (select languages from public.call_closers_directory() limit 1), array['English', 'French']::text[]);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('only call closers can set them', $q$ select public.save_my_closer_languages('English', '{}') $q$, '42501');
  perform tests.eq('other affiliates see the languages in the list', (select native_language from public.call_closers_directory() limit 1), 'Spanish');
  perform tests.logout();
end $$;
rollback;
