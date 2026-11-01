-- Phase 5h rules: Important Updates, views, audit and undo.
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

-- Family tree
do $$ declare r uuid; l uuid; ll uuid; tok text; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.family_tree_nodes (owner_id, parent_id, side, label, rank) values ('00000000-0000-0000-0000-0000000000a1', null, 'left', 'Anna', '3A') returning id into l;
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values ('00000000-0000-0000-0000-0000000000a1', null, 'right', 'Ben');
  insert into public.family_tree_nodes (owner_id, parent_id, side, label, linked_member_id) values ('00000000-0000-0000-0000-0000000000a1', l, 'left', 'Max', '00000000-0000-0000-0000-0000000000a5') returning id into ll;
  -- a side can hold as many accounts as you like (added then taken away again so the counts below stay the same)
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values ('00000000-0000-0000-0000-0000000000a1', l, 'left', 'Dup');
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values ('00000000-0000-0000-0000-0000000000a1', null, 'left', 'Third');
  perform tests.eq('a side can hold more than one account', (select count(*) from public.family_tree_nodes where label in ('Dup', 'Third', 'Max')), 3::bigint);
  delete from public.family_tree_nodes where label in ('Dup', 'Third');
  perform tests.fails('a bubble cannot be moved', format($q$ update public.family_tree_nodes set side = 'right' where id = %L $q$, ll), '23514');
  perform tests.eq('I can rename a bubble', (select count(*) from (select 1 from public.family_tree_nodes where id = ll) x), 1::bigint);
  update public.family_tree_nodes set label = 'Maxine' where id = ll;
  perform tests.eq('renamed', (select label from public.family_tree_nodes where id = ll), 'Maxine');
  perform tests.fails('cannot build in someone elses tree', $q$ insert into public.family_tree_nodes (owner_id, parent_id, side, label) values ('00000000-0000-0000-0000-0000000000a5', null, 'left', 'Sneaky') $q$, '42501');
  perform tests.eq('I see my three bubbles', (select count(*) from public.family_tree_nodes), 3::bigint);
  tok := public.set_tree_sharing(true);
  perform tests.eq('the link is 64 characters', char_length(tok), 64);
  perform tests.eq('turning it on again keeps the link', public.set_tree_sharing(true), tok);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('others cannot see my tree', (select count(*) from public.family_tree_nodes), 0::bigint);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('anyone with the link sees it', (select count(*) from public.shared_tree(tok)), 3::bigint);
  perform tests.eq('a wrong link shows nothing', (select count(*) from public.shared_tree(repeat('a', 64))), 0::bigint);
  perform tests.eq('a short link shows nothing', (select count(*) from public.shared_tree('abc')), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.set_tree_sharing(false);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('after switching off the old link shows nothing', (select count(*) from public.shared_tree(tok)), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  delete from public.family_tree_nodes where id = l;
  perform tests.eq('removing a bubble removes its branch', (select count(*) from public.family_tree_nodes), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('leads cannot build one', $q$ insert into public.family_tree_nodes (owner_id, parent_id, side, label) values ('00000000-0000-0000-0000-0000000000a3', null, 'left', 'X') $q$, '42501');
  perform tests.logout();
end $$;

do $$ declare tok text; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.family_tree_nodes (owner_id, parent_id, side, label, owned) values ('00000000-0000-0000-0000-0000000000a1', null, 'left', 'My own account', true);
  perform tests.eq('a bubble can be marked as mine', (select owned from public.family_tree_nodes where label = 'My own account'), true);
  perform public.save_tree_root('My Organisation', '6A2');
  tok := public.set_tree_sharing(true);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('the shared tree carries the top bubble name', (select owner_name from public.shared_tree(tok) limit 1), 'My Organisation');
  perform tests.eq('and its rank', (select root_rank from public.shared_tree(tok) limit 1), '6A2');
  perform tests.eq('and which accounts are the owners', (select owned from public.shared_tree(tok) where label = 'My own account'), true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.save_tree_root(repeat('x', 70), null);
  perform tests.eq('a long top bubble name is shortened to 60', (select char_length(root_label) from public.family_trees where owner_id = '00000000-0000-0000-0000-0000000000a5'), 60);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('leads cannot edit a top bubble', $q$ select public.save_tree_root('X', null) $q$, '42501');
  perform tests.logout();
end $$;
rollback;
