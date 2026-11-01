-- Phase 89: push for every chat message, and muting a chat.
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

-- Mia (member), Ada (admin), Max (member), Lena (lead). Mia, Max and Lena have push set up.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://x/' || id, 'k', 'a' from public.profiles where username in ('miamember','maxmember','lenalead');

do $$
declare ch uuid; g uuid; n int;
begin
  select id into ch from public.chats where slug = 'welcome-discussion';
  -- Ada posts: Mia, Max and Lena get a push row, Ada does not
  insert into public.chat_posts (chat_id, author_id, body) values (ch, '00000000-0000-0000-0000-0000000000a4', 'Hello everyone');
  perform tests.eq('mia gets one', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'chat_message'), 1::bigint);
  perform tests.eq('lena gets one', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'chat_message'), 1::bigint);
  perform tests.eq('author gets none', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a4' and kind = 'chat_message'), 0::bigint);
  perform tests.eq('already marked read (no bell number)', (select count(*) from public.notifications where kind = 'chat_message' and read_at is null), 0::bigint);

  -- affiliates-only chat: the lead gets nothing
  select id into ch from public.chats where min_role = 'member' and slug <> 'important-updates' limit 1;
  insert into public.chat_posts (chat_id, author_id, body) values (ch, '00000000-0000-0000-0000-0000000000a4', 'Affiliates only');
  perform tests.eq('lead skipped in affiliate chat', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'chat_message'), 1::bigint);
  perform tests.eq('max got both', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and kind = 'chat_message'), 2::bigint);

  -- Max mutes that chat for an hour: no new push for him there; Mia still gets it
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.set_chat_mute('chat', ch, now() + interval '1 hour');
  perform tests.eq('mute is saved', (select count(*) from public.chat_mutes), 1::bigint);
  perform tests.fails('cannot mute in the past', format('select public.set_chat_mute(''chat'', %L, now() - interval ''1 hour'')', ch), '22023');
  perform tests.logout();
  insert into public.chat_posts (chat_id, author_id, body) values (ch, '00000000-0000-0000-0000-0000000000a4', 'Again');
  perform tests.eq('muted: no push for max', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and kind = 'chat_message'), 2::bigint);
  perform tests.eq('mia still gets it', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'chat_message'), 3::bigint);

  -- the mute runs out
  update public.chat_mutes set until = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-0000000000a5';
  insert into public.chat_posts (chat_id, author_id, body) values (ch, '00000000-0000-0000-0000-0000000000a4', 'Back on');
  perform tests.eq('after the mute ends: push again', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and kind = 'chat_message'), 3::bigint);

  -- forever, then unmute
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.set_chat_mute('chat', ch, null);
  perform tests.eq('forever has no end', (select count(*) from public.chat_mutes where until is null), 1::bigint);
  perform public.set_chat_mute('chat', ch, null, true);
  perform tests.eq('unmuted', (select count(*) from public.chat_mutes), 0::bigint);
  perform tests.logout();

  -- groups: members only, never the sender, mute works there too
  insert into public.group_chats (id, name, created_by) values ('00000000-0000-0000-0000-00000000f001', 'Crew', '00000000-0000-0000-0000-0000000000a1');
  g := '00000000-0000-0000-0000-00000000f001';
  insert into public.group_members (group_id, user_id, role) values (g, '00000000-0000-0000-0000-0000000000a1', 'owner'), (g, '00000000-0000-0000-0000-0000000000a5', 'member'), (g, '00000000-0000-0000-0000-0000000000a4', 'member');
  insert into public.group_messages (group_id, author_id, body) values (g, '00000000-0000-0000-0000-0000000000a1', 'Hi crew');
  perform tests.eq('group: max gets a push', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and url = '/groups/' || g), 1::bigint);
  perform tests.eq('group: sender none', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and url = '/groups/' || g), 0::bigint);
  perform tests.eq('group: non-subscriber (admin) none', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a4' and url = '/groups/' || g), 0::bigint);
  perform tests.eq('group: outsider (lena) none', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a3' and url = '/groups/' || g), 0::bigint);
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.set_chat_mute('group', g, null);
  perform tests.logout();
  insert into public.group_messages (group_id, author_id, body) values (g, '00000000-0000-0000-0000-0000000000a1', 'Hello?');
  perform tests.eq('group: muted forever', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and url = '/groups/' || g), 1::bigint);

  -- nobody can read or change someone else's mutes
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('mia cannot see max mute', (select count(*) from public.chat_mutes), 0::bigint);
  perform tests.fails('cannot write mutes directly', 'insert into public.chat_mutes (user_id, kind, target) values (auth.uid(), ''chat'', gen_random_uuid())', '42501');
  perform tests.logout();
end $$;
rollback;
