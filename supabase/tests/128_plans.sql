-- Phase 200: plans.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('dee@example.com','downline');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a6','dee@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Dee', last_name='D', username='deedownline', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; dee uuid := '00000000-0000-0000-0000-0000000000a6';
begin
  perform tests.login(mia);
  perform tests.fails('nobody puts themselves on a plan', format('update public.profiles set plan = 47 where id = %L', mia), '42501');
  perform tests.logout();
  perform tests.login(ada);
  update public.profiles set plan = 77 where id = mia;
  update public.profiles set plan = 47 where id = ada;
  perform tests.fails('only the three plans exist', format('update public.profiles set plan = 50 where id = %L', mia), '23514');
  perform tests.logout();
  perform tests.login(dee);
  perform tests.eq('anyone signed in sees the counts', (select n from public.plan_counts() where tier = 77), 1);
  perform tests.eq('and the other plans', (select n from public.plan_counts() where tier = 297), 0);
  perform tests.eq('and the latest sign-ups (first name only)', (select count(*) from public.recent_plan_purchases() where first_name = 'Mia' and tier = 77), 1::bigint);
  insert into public.plan_interest (user_id, tier) values (dee, 297);
  perform tests.eq('wanting a plan is remembered', (select count(*) from public.plan_interest where user_id = dee), 1::bigint);
  perform tests.fails('and only for yourself', format('insert into public.plan_interest (user_id, tier) values (%L, 47)', mia), '42501');
  perform tests.logout();
end $$;
rollback;
