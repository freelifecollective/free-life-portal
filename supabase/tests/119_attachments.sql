-- Attachments, forwarding labels and replies with a voice note.
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

do $$ declare ch uuid; p uuid; g uuid := '00000000-0000-0000-0000-00000000f001';
  f text := 'https://abc.supabase.co/storage/v1/object/public/chat-files/00000000-0000-0000-0000-0000000000a1/22222222-2222-2222-2222-222222222222.pdf';
  v text := 'https://abc.supabase.co/storage/v1/object/public/voice-notes/00000000-0000-0000-0000-0000000000a1/33333333-3333-3333-3333-333333333333.webm'; begin
  select id into ch from public.chats where slug = 'welcome-discussion';
  insert into public.chat_posts (chat_id, author_id, body, attach_url, attach_name, attach_type, attach_size) values (ch, '00000000-0000-0000-0000-0000000000a1', 'Attachment', f, 'Plan.pdf', 'application/pdf', 52000) returning id into p;
  perform tests.eq('a file in a chat', (select attach_name from public.chat_posts where id = p), 'Plan.pdf');
  perform tests.fails('a file link from somewhere else is refused', format('insert into public.chat_posts (chat_id, author_id, body, attach_url, attach_name, attach_type, attach_size) values (%L, %L, %L, %L, %L, %L, 5)', ch, '00000000-0000-0000-0000-0000000000a1', 'Attachment', 'https://evil.example/x.pdf', 'x.pdf', 'application/pdf'), '23514');
  perform tests.fails('a file over 25 MB is refused', format('insert into public.chat_posts (chat_id, author_id, body, attach_url, attach_name, attach_type, attach_size) values (%L, %L, %L, %L, %L, %L, 26214401)', ch, '00000000-0000-0000-0000-0000000000a1', 'Attachment', f, 'x.pdf', 'application/pdf'), '23514');
  insert into public.chat_posts (chat_id, author_id, body, forwarded_from) values (ch, '00000000-0000-0000-0000-0000000000a5', 'Look at this', 'Mia M');
  perform tests.eq('a forwarded message keeps who it came from', (select forwarded_from from public.chat_posts where body = 'Look at this'), 'Mia M');
  insert into public.group_chats (id, name, created_by) values (g, 'Crew', '00000000-0000-0000-0000-0000000000a1');
  insert into public.group_members (group_id, user_id, role) values (g, '00000000-0000-0000-0000-0000000000a1', 'owner');
  insert into public.group_messages (group_id, author_id, body, attach_url, attach_name, attach_type, attach_size) values (g, '00000000-0000-0000-0000-0000000000a1', 'Attachment', f, 'Plan.pdf', 'application/pdf', 52000);
  perform tests.eq('a file in a group', (select count(*) from public.group_messages where attach_url = f), 1::bigint);
  perform tests.eq('a group file cannot be edited', public.edit_group_message((select id from public.group_messages where attach_url = f), 'changed') , false);

  insert into public.chat_comments (post_id, author_id, body, audio_url, audio_secs) values (p, '00000000-0000-0000-0000-0000000000a5', 'Voice note', v, 20);
  perform tests.eq('a voice note as a reply', (select count(*) from public.chat_comments where audio_url = v), 1::bigint);

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.direct_messages (sender_id, recipient_id, body, attach_url, attach_name, attach_type, attach_size, forwarded_from) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5', '', f, 'Plan.pdf', 'application/pdf', 52000, 'Sonya');
  perform tests.eq('a file-only direct message', (select count(*) from public.direct_messages where attach_url = f), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the receiver was told about the file', (select count(*) from public.notifications where kind = 'direct_message' and body like '%file%'), 1::bigint);
  perform tests.fails('the file cannot be swapped afterwards', format('update public.direct_messages set attach_url = %L where attach_url = %L', replace(f, '222222', '444444'), f), '42501');
  perform tests.logout();
end $$;
rollback;
