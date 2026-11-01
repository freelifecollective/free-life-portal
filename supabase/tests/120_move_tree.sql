-- Phase 113: moving an account in Your Organization.
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

do $$ declare a uuid; b uuid; c uuid; d uuid; s1 uuid; s2 uuid; s3 uuid; me uuid := '00000000-0000-0000-0000-0000000000a1'; other uuid;
begin
  perform tests.login(me);
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values (me, null, 'left', 'A') returning id into a;
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values (me, null, 'right', 'B') returning id into b;
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values (me, a, 'left', 'C') returning id into c;
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values (me, c, 'left', 'D') returning id into d;
  perform tests.fails('moving by a plain update is still refused', format('update public.family_tree_nodes set parent_id = %L where id = %L', b, c), '23514');

  perform public.move_tree_node(c, b, 'right');
  perform tests.eq('C is now under B on the right', (select parent_id::text || side from public.family_tree_nodes where id = c), b::text || 'right');
  perform tests.eq('D came along under C', (select parent_id from public.family_tree_nodes where id = d), c);
  perform public.move_tree_node(c, null, 'left');
  perform tests.eq('C can go back to the top', (select parent_id is null from public.family_tree_nodes where id = c), true);
  perform tests.fails('a bubble cannot go under itself', format('select public.move_tree_node(%L, %L, %L)', c, c, 'left'), '23514');
  perform tests.fails('or under something below it', format('select public.move_tree_node(%L, %L, %L)', c, d, 'left'), '23514');
  perform tests.fails('a bad side is refused', format('select public.move_tree_node(%L, %L, %L)', c, b, 'middle'), '22023');

  -- where it sits among the others
  insert into public.family_tree_nodes (owner_id, parent_id, side, label, created_at) values (me, b, 'left', 'S1', now() - interval '3 hour') returning id into s1;
  insert into public.family_tree_nodes (owner_id, parent_id, side, label, created_at) values (me, b, 'left', 'S2', now() - interval '2 hour') returning id into s2;
  insert into public.family_tree_nodes (owner_id, parent_id, side, label, created_at) values (me, b, 'left', 'S3', now() - interval '1 hour') returning id into s3;
  perform public.move_tree_node(s3, b, 'left', null, true);
  perform tests.eq('first puts it before the others', (select string_agg(label, ',' order by created_at) from public.family_tree_nodes where parent_id = b and side = 'left'), 'S3,S1,S2');
  perform public.move_tree_node(s3, b, 'left', s1, false);
  perform tests.eq('after puts it right behind the one chosen', (select string_agg(label, ',' order by created_at) from public.family_tree_nodes where parent_id = b and side = 'left'), 'S1,S3,S2');
  perform public.move_tree_node(s1, b, 'left');
  perform tests.eq('with nothing chosen it goes to the end', (select string_agg(label, ',' order by created_at) from public.family_tree_nodes where parent_id = b and side = 'left'), 'S3,S2,S1');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  insert into public.family_tree_nodes (owner_id, parent_id, side, label) values ('00000000-0000-0000-0000-0000000000a5', null, 'left', 'X') returning id into other;
  perform tests.fails('you cannot move someone elses bubble', format('select public.move_tree_node(%L, null, %L)', c, 'right'), '42501');
  perform tests.fails('or hang yours under their bubble', format('select public.move_tree_node(%L, %L, %L)', other, b, 'left'), '23514');
  perform tests.logout();
end $$;
rollback;
