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

-- Conversations and groups
do $$ declare g uuid; m1 uuid; m2 uuid; cid uuid; p1 uuid; p2 uuid; n int; begin
  perform tests.eq('community chats became conversations', (select count(*) from public.chats where mode = 'conversation' and slug = 'important-updates'), 0::bigint);
  perform tests.eq('the voting chat stays a feed', (select mode from public.chats where slug = 'verbiage-objections'), 'feed');
  perform tests.eq('a normal chat is a conversation', (select mode from public.chats where slug = 'wins'), 'conversation');
  select id into cid from public.chats where slug = 'qa-discussion';
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.chat_posts (chat_id, author_id, body) values (cid, '00000000-0000-0000-0000-0000000000a1', 'Hello there') returning id into p1;
  insert into public.chat_posts (chat_id, author_id, body, reply_to) values (cid, '00000000-0000-0000-0000-0000000000a1', 'Replying to myself', p1) returning id into p2;
  perform tests.eq('a message can quote another', (select reply_to from public.chat_posts where id = p2), p1);
  delete from public.chat_posts where id = p1;
  perform tests.eq('deleting the quoted message keeps the reply', (select count(*) from public.chat_posts where id = p2 and reply_to is null), 1::bigint);
  -- groups
  g := public.create_group('Team Spain', array['00000000-0000-0000-0000-0000000000a5'::uuid, '00000000-0000-0000-0000-0000000000a3'::uuid]);
  perform tests.eq('the creator and an affiliate are in; a lead is not', (select count(*) from public.group_members where group_id = g), 2::bigint);
  perform tests.eq('the creator owns it', public.is_group_owner(g), true);
  insert into public.group_messages (group_id, author_id, body) values (g, '00000000-0000-0000-0000-0000000000a1', 'Welcome!') returning id into m1;
  insert into public.group_messages (group_id, author_id, body, reply_to) values (g, '00000000-0000-0000-0000-0000000000a1', 'Thanks all', m1) returning id into m2;
  perform tests.fails('no one can post as someone else', format($q$ insert into public.group_messages (group_id, author_id, body) values (%L, '00000000-0000-0000-0000-0000000000a5', 'fake') $q$, g), '42501');
  perform tests.logout();
  update public.group_members set last_read_at = now() - interval '1 hour' where user_id = '00000000-0000-0000-0000-0000000000a5';
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the invited affiliate sees the group', (select count(*) from public.group_chats), 1::bigint);
  perform tests.eq('and was told', (select count(*) from public.notifications where title like '% added you to a group'), 1::bigint);
  perform tests.eq('with two unread messages', (select unread from public.group_overview()), 2);
  perform public.mark_group_read(g);
  perform tests.eq('reading clears the count', (select unread from public.group_overview()), 0);
  insert into public.group_messages (group_id, author_id, body) values (g, '00000000-0000-0000-0000-0000000000a5', 'Hi!');
  perform tests.fails('members cannot add people', format($q$ select public.add_group_members(%L, array['00000000-0000-0000-0000-0000000000a4'::uuid]) $q$, g), '42501');
  delete from public.group_messages where id = m1;
  perform tests.eq('members cannot delete the owner message', (select count(*) from public.group_messages where id = m1), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('outsiders see no groups', (select count(*) from public.group_chats), 0::bigint);
  perform tests.eq('and no messages', (select count(*) from public.group_messages), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('a lead cannot start a group', $q$ select public.create_group('Nope', '{}') $q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.add_group_members(g, array['00000000-0000-0000-0000-0000000000a4'::uuid]);
  perform tests.eq('the owner can add someone', (select count(*) from public.group_members where group_id = g), 3::bigint);
  perform public.rename_group(g, 'Team Spain & Italy');
  perform tests.eq('and rename it', (select name from public.group_chats where id = g), 'Team Spain & Italy');
  perform public.remove_group_member(g, '00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('and remove someone', (select count(*) from public.group_members where group_id = g), 2::bigint);
  perform public.remove_group_member(g, '00000000-0000-0000-0000-0000000000a1');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('when the owner leaves the next member takes over', public.is_group_owner(g), true);
  perform public.remove_group_member(g, '00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('and an empty group disappears', (select count(*) from public.group_chats where id = g), 0::bigint);
  perform tests.logout();
end $$;
rollback;
