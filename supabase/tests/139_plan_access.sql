-- Plan access: founders price, Lacey's Downline mark, and who counts as being on a plan.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('dee@example.com','downline');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a6','dee@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Dee', last_name='D', username='deedownline', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; dee uuid := '00000000-0000-0000-0000-0000000000a6';
begin
  perform tests.eq('a downline account is marked as Lacey''s Downline', (select lacey_downline from public.profiles where id = dee), true);
  perform tests.eq('a member is not, unless an admin says so', (select lacey_downline from public.profiles where id = mia), false);

  perform tests.login(mia);
  perform tests.fails('nobody gives themselves the founders price', format('update public.profiles set founder = true where id = %L', mia), '42501');
  perform tests.fails('or marks themselves as Lacey''s Downline', format('update public.profiles set lacey_downline = true where id = %L', mia), '42501');
  perform tests.eq('without a plan, Builder features are closed', public.plan_at_least(97::smallint), false);
  perform tests.logout();

  perform tests.login(ada);
  update public.profiles set plan = 47, founder = true where id = mia;
  update public.profiles set plan = 97, role = 'member' where id = dee;
  perform tests.eq('an admin is always let in', public.plan_at_least(297::smallint), true);
  perform tests.logout();

  perform tests.eq('the downline mark stays when they start paying', (select lacey_downline from public.profiles where id = dee), true);

  perform tests.login(mia);
  perform tests.eq('Starter is not enough for Builder features', public.plan_at_least(97::smallint), false);
  perform tests.eq('but is enough for Starter features', public.plan_at_least(47::smallint), true);
  perform tests.logout();

  perform tests.login(dee);
  perform tests.eq('Builder opens Builder features', public.plan_at_least(97::smallint), true);
  perform tests.eq('but not Leader features', public.plan_at_least(297::smallint), false);
  perform tests.logout();
end $$;
rollback;
