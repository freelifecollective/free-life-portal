-- Phase 144: undo and redo for charts.
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

do $$ declare me uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; c1 uuid; a uuid; b uuid; d uuid; snap jsonb; n int;
begin
  perform tests.login(me);
  c1 := public.ensure_default_chart();
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label, rank, owned) values (me, c1, null, 'left', 'A', '1A', true) returning id into a;
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, a, 'left', 'B') returning id into b;
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, b, 'right', 'D') returning id into d;
  snap := (select jsonb_agg(jsonb_build_object('id', id, 'parent_id', parent_id, 'side', side, 'label', label, 'rank', rank, 'linked_member_id', linked_member_id, 'owned', owned) order by created_at) from public.family_tree_nodes where chart_id = c1);
  perform public.move_tree_node(d, a, 'right');
  delete from public.family_tree_nodes where id = b;
  perform tests.eq('after the changes there are 2 bubbles', (select count(*) from public.family_tree_nodes where chart_id = c1), 2::bigint);
  perform public.restore_chart_nodes(c1, snap);
  perform tests.eq('undo brings back all 3', (select count(*) from public.family_tree_nodes where chart_id = c1), 3::bigint);
  perform tests.eq('with the same ids', (select count(*) from public.family_tree_nodes where id in (a, b, d)), 3::bigint);
  perform tests.eq('D is back under B', (select parent_id from public.family_tree_nodes where id = d), b);
  perform tests.eq('B is under A', (select parent_id from public.family_tree_nodes where id = b), a);
  perform tests.eq('A keeps its rank and ownership', (select rank || owned::text from public.family_tree_nodes where id = a), '1Atrue');
  perform tests.eq('the order is kept', (select string_agg(label, '' order by created_at) from public.family_tree_nodes where chart_id = c1), 'ABD');
  perform public.copy_chart_top(c1, c1, 'right', false, d);
  perform tests.eq('the top bubble can be pasted under a chosen bubble', (select count(*) from public.family_tree_nodes where parent_id = d), 1::bigint);
  perform public.copy_tree_nodes(a, c1, d, 'right', true);
  perform tests.eq('a bubble and everything under it can be pasted under another', (select count(*) from public.family_tree_nodes where parent_id = d), 2::bigint);
  perform public.restore_chart_nodes(c1, '[]'::jsonb);
  perform tests.eq('an empty snapshot empties the chart', (select count(*) from public.family_tree_nodes where chart_id = c1), 0::bigint);
  perform tests.logout();
  perform tests.login(max);
  perform tests.fails('not someone else''s chart', format('select public.restore_chart_nodes(%L, ''[]'')', c1), '42501');
  perform tests.logout();
end $$;
rollback;
