-- Phase 92: editing group messages and call lengths.
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

do $$
declare g uuid := '00000000-0000-0000-0000-00000000f001'; m uuid; ok boolean;
begin
  insert into public.group_chats (id, name, created_by) values (g, 'Crew', '00000000-0000-0000-0000-0000000000a1');
  insert into public.group_members (group_id, user_id, role) values (g, '00000000-0000-0000-0000-0000000000a1', 'owner'), (g, '00000000-0000-0000-0000-0000000000a5', 'member');
  insert into public.group_messages (group_id, author_id, body) values (g, '00000000-0000-0000-0000-0000000000a1', 'first') returning id into m;
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  ok := public.edit_group_message(m, 'changed');
  perform tests.eq('author can edit', ok, true);
  perform tests.eq('text changed', (select body from public.group_messages where id = m), 'changed');
  perform tests.eq('edited time set', (select edited_at is not null from public.group_messages where id = m), true);
  perform tests.fails('empty is refused', format('select public.edit_group_message(%L, %L)', m, '  '), '22023');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  ok := public.edit_group_message(m, 'hijack');
  perform tests.eq('someone else cannot edit', ok, false);
  perform tests.logout();
  perform tests.eq('text kept', (select body from public.group_messages where id = m), 'changed');

  -- call lengths: 20 to 60 in fives
  insert into public.coach_settings (member_id, call_minutes, tz) values ('00000000-0000-0000-0000-0000000000a1', 25, 'UTC');
  perform tests.fails('15 is too short', 'update public.coach_settings set call_minutes = 15', '23514');
  perform tests.fails('22 is not a step of 5', 'update public.coach_settings set call_minutes = 22', '23514');
  perform tests.fails('65 is too long', 'update public.coach_settings set call_minutes = 65', '23514');
  update public.coach_settings set call_minutes = 55;
  perform tests.eq('55 is fine', (select call_minutes from public.coach_settings), 55::smallint);
end $$;
rollback;
