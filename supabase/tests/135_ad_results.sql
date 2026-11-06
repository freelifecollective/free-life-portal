-- Phase 221: ad results are private to their owner.
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a2','max@example.com');
do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a2';
begin
  perform tests.login(mia);
  insert into public.ad_results (user_id, spend, leads) values (mia, 120.50, 14);
  perform tests.eq('an affiliate sees their own results', (select count(*) from public.ad_results), 1::bigint);
  perform tests.logout();
  perform tests.login(max);
  perform tests.eq('another affiliate sees none of them', (select count(*) from public.ad_results), 0::bigint);
  begin insert into public.ad_results (user_id, spend) values (mia, 5); raise exception 'FAIL wrote for someone else'; exception when insufficient_privilege then raise notice 'ok   cannot write for someone else'; end;
  perform tests.logout();
end $$;
rollback;
