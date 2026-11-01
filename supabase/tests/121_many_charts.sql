-- Phase 117: many charts and copying between them.
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
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';

do $$ declare me uuid := '00000000-0000-0000-0000-0000000000a1'; c1 uuid; c2 uuid; c3 uuid; a uuid; b uuid; d uuid; n int; tok text; cp uuid; other uuid;
begin
  perform tests.login(me);
  c1 := public.ensure_default_chart();
  perform tests.eq('everyone gets a first chart', (select count(*) from public.family_charts where owner_id = me), 1::bigint);
  perform tests.eq('asking again gives the same one', public.ensure_default_chart(), c1);
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, null, 'left', 'A') returning id into a;
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, a, 'left', 'B') returning id into b;
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (me, c1, b, 'right', 'D') returning id into d;

  c2 := public.create_chart('Vision board');
  perform tests.eq('a second chart starts empty', (select count(*) from public.family_tree_nodes where chart_id = c2), 0::bigint);
  c3 := public.create_chart('Copy of mine', c1);
  perform tests.eq('a copy has everything', (select count(*) from public.family_tree_nodes where chart_id = c3), 3::bigint);
  perform tests.eq('and keeps the shape', (select count(*) from public.family_tree_nodes x join public.family_tree_nodes p on p.id = x.parent_id where x.chart_id = c3 and p.chart_id = c3), 2::bigint);
  perform tests.eq('the original is untouched', (select count(*) from public.family_tree_nodes where chart_id = c1), 3::bigint);

  -- copying into another chart
  cp := public.copy_tree_nodes(b, c2, null, 'right', true);
  perform tests.eq('B and D were copied', (select count(*) from public.family_tree_nodes where chart_id = c2), 2::bigint);
  perform tests.eq('the copy sits on the right under the top', (select side || coalesce(parent_id::text, 'top') from public.family_tree_nodes where id = cp), 'righttop');
  cp := public.copy_tree_nodes(a, c2, null, 'left', false);
  perform tests.eq('just one bubble when asked', (select count(*) from public.family_tree_nodes where chart_id = c2), 3::bigint);

  -- bubbles stay inside their chart
  perform tests.fails('cannot hang a bubble under one from another chart', format($q$ insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label) values (%L, %L, %L, 'left', 'X') $q$, me, c2, a), '23514');
  perform tests.fails('cannot move a bubble into another chart', format('select public.move_tree_node(%L, %L, %L)', d, cp, 'left'), '23514');

  -- rename, share, delete
  perform public.rename_chart(c2, 'Dream team');
  perform tests.eq('rename', (select name from public.family_charts where id = c2), 'Dream team');
  tok := public.set_chart_sharing(c2, true);
  perform tests.eq('a share link is made for that chart only', (select count(*) from public.family_charts where owner_id = me and share_token is not null), 1::bigint);
  perform tests.eq('the link shows that chart', (select count(*) from public.shared_tree(tok) where chart_name = 'Dream team'), 3::bigint);
  perform public.save_chart_root(c2, 'Sonya R', '5A');
  perform tests.eq('the top bubble is per chart', (select root_label from public.family_charts where id = c2), 'Sonya R');
  perform tests.eq('and the other chart is not changed', (select root_label is null from public.family_charts where id = c1), true);
  perform public.delete_chart(c3);
  perform tests.eq('deleting a chart deletes its bubbles', (select count(*) from public.family_tree_nodes where chart_id = c3), 0::bigint);
  perform tests.logout();

  -- other people
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  other := public.ensure_default_chart();
  perform tests.eq('nobody sees another persons charts', (select count(*) from public.family_charts where owner_id = me), 0::bigint);
  perform tests.fails('and cannot copy into them', format('select public.copy_tree_nodes(%L, %L, null, %L, true)', (select id from public.family_tree_nodes limit 1), c1, 'left'), '42501');
  perform tests.logout();
  perform tests.login(me);
  perform public.delete_chart(c2);
  perform tests.fails('the last chart cannot be deleted', format('select public.delete_chart(%L)', c1), '23514');
  perform tests.logout();
end $$;
rollback;
