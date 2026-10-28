-- Phase 5d rules: private rank and the admin flag.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';

select tests.eq('cards say who is an admin', (select is_admin from public.profile_cards where username = 'adaadmin'), true);
select tests.eq('and who is not', (select is_admin from public.profile_cards where username = 'miamember'), false);

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.member_private (member_id, rank_id) values (auth.uid(), 3);
  perform tests.eq('a member can save their rank', (select rank_id from public.member_private), 3::smallint);
  perform tests.eq('and change it', tests.rows('update public.member_private set rank_id = 4'), 1::bigint);
  perform tests.fails('nobody saves a rank for someone else', format('insert into public.member_private (member_id, rank_id) values (%L, 2)', '00000000-0000-0000-0000-0000000000a4'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an admin can see ranks', (select count(*) from public.member_private), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('other people cannot see ranks', (select count(*) from public.member_private), 0::bigint);
  perform tests.fails('leads cannot save a rank', format('insert into public.member_private (member_id, rank_id) values (auth.uid(), 1)'), '42501');
  perform tests.logout();
end $$;
rollback;
