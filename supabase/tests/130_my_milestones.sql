-- Phase 153: log your own coaching calls and sales.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('max@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; e uuid;
begin
  perform tests.login(mia);
  insert into public.milestone_events (member_id, kind, happened_on, logged_by) values (mia, 'coaching', current_date, mia) returning id into e;
  perform tests.eq('you can log your own coaching call', (select count(*) from public.milestone_events where member_id = mia and kind = 'coaching'), 1::bigint);
  perform tests.fails('but not one for someone else', format('insert into public.milestone_events (member_id, kind, logged_by) values (%L, ''sale'', %L)', max, mia), '42501');
  perform tests.fails('or one from last year', format('insert into public.milestone_events (member_id, kind, happened_on, logged_by) values (%L, ''sale'', current_date - 500, %L)', mia, mia), '42501');
  delete from public.milestone_events where id = e;
  perform tests.eq('you can remove your own', (select count(*) from public.milestone_events where member_id = mia), 0::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.fails('a lead cannot log', format('insert into public.milestone_events (member_id, kind, logged_by) values (%L, ''sale'', %L)', lena, lena), '42501');
  perform tests.logout();
end $$;
rollback;
