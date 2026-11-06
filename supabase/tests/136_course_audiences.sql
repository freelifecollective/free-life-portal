-- Phase 226: courses can be shown to members, downline and leads in any mix.
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
insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('lena@example.com','lead'),('dan@example.com','downline');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a6','dan@example.com');
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Dan', last_name='D', username='dandown', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';
insert into public.classroom_courses (title, published, for_members, for_downline, for_leads) values
  ('Members only', true, true, false, false), ('Downline only', true, false, true, false), ('Leads only', true, false, false, true),
  ('All three', true, true, true, true), ('Draft', false, true, true, true);
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a member sees members and all-three', (select count(*) from public.classroom_overview()), 2::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a6');
  perform tests.eq('the downline sees downline and all-three', (select count(*) from public.classroom_overview()), 2::bigint);
  perform tests.eq('and not the members-only course', (select count(*) from public.classroom_overview() where title = 'Members only'), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees leads and all-three', (select count(*) from public.classroom_overview()), 2::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an admin sees every course', (select count(*) from public.classroom_overview()), 5::bigint);
  perform tests.logout();
end $$;
rollback;
