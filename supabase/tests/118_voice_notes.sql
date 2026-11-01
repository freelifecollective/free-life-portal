-- Voice notes in chats, groups and direct messages.
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

do $$ declare ch uuid; g uuid := '00000000-0000-0000-0000-00000000f001'; good text := 'https://abc.supabase.co/storage/v1/object/public/voice-notes/00000000-0000-0000-0000-0000000000a1/11111111-1111-1111-1111-111111111111.webm'; begin
  select id into ch from public.chats where slug = 'welcome-discussion';
  insert into public.chat_posts (chat_id, author_id, body, audio_url, audio_secs) values (ch, '00000000-0000-0000-0000-0000000000a1', 'Voice note', good, 12);
  perform tests.eq('a voice note in a chat', (select count(*) from public.chat_posts where audio_url = good), 1::bigint);
  perform tests.fails('a link to somewhere else is refused', format('insert into public.chat_posts (chat_id, author_id, body, audio_url, audio_secs) values (%L, %L, %L, %L, 5)', ch, '00000000-0000-0000-0000-0000000000a1', 'Voice note', 'https://evil.example/x.webm'), '23514');
  perform tests.fails('a recording over an hour is refused', format('insert into public.chat_posts (chat_id, author_id, body, audio_url, audio_secs) values (%L, %L, %L, %L, 3601)', ch, '00000000-0000-0000-0000-0000000000a1', 'Voice note', good), '23514');
  insert into public.chat_posts (chat_id, author_id, body, audio_url, audio_secs) values (ch, '00000000-0000-0000-0000-0000000000a1', 'Voice note', good, 3000);
  perform tests.eq('a 50 minute voice note is fine', (select count(*) from public.chat_posts where audio_secs = 3000), 1::bigint);
  insert into public.group_chats (id, name, created_by) values (g, 'Crew', '00000000-0000-0000-0000-0000000000a1');
  insert into public.group_members (group_id, user_id, role) values (g, '00000000-0000-0000-0000-0000000000a1', 'owner');
  insert into public.group_messages (group_id, author_id, body, audio_url, audio_secs) values (g, '00000000-0000-0000-0000-0000000000a1', 'Voice note', good, 30);
  perform tests.eq('a voice note in a group', (select count(*) from public.group_messages where audio_url = good), 1::bigint);

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.direct_messages (sender_id, recipient_id, body, audio_url, audio_secs) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5', '', good, 7);
  perform tests.eq('a voice-only direct message (no words)', (select count(*) from public.direct_messages where audio_url = good), 1::bigint);
  perform tests.fails('an empty message with nothing in it is still refused', $q$ insert into public.direct_messages (sender_id, recipient_id, body) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5', ' ') $q$, '23514');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('the voice note cannot be swapped afterwards', format('update public.direct_messages set audio_url = %L where audio_url = %L', replace(good, '111111', '222222'), good), '42501');
  perform tests.eq('the receiver was told', (select count(*) from public.notifications where kind = 'direct_message' and body like '%voice note%'), 1::bigint);
  perform tests.logout();
end $$;
rollback;
