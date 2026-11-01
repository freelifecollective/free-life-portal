-- Phase 121: copy the top bubble into another chart.
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

do $$ declare me uuid := '00000000-0000-0000-0000-0000000000a1'; c1 uuid; c2 uuid; a uuid; top uuid;
begin
  perform tests.login(me);
  c1 := public.ensure_default_chart();
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, null, 'left', 'A') returning id into a;
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, a, 'left', 'B');
  c2 := public.create_chart('Other');
  top := public.copy_chart_top(c1, c2, 'right', false);
  perform tests.eq('top alone: one bubble', (select count(*) from public.family_tree_nodes where chart_id = c2), 1::bigint);
  perform tests.eq('top is named after me', (select label from public.family_tree_nodes where id = top), 'Mia M');
  perform public.copy_chart_top(c1, c2, 'left', true);
  perform tests.eq('top + below: bubble plus 2 more', (select count(*) from public.family_tree_nodes where chart_id = c2), 4::bigint);
  perform tests.fails('not someone else''s chart', format('select public.copy_chart_top(%L, %L, ''left'', true)', c1, gen_random_uuid()), '42501');
end $$;
rollback;
