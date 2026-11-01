-- Phase 90: unread numbers, seen-by, GIFs.
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
declare ch uuid; g uuid; n int; t0 timestamptz;
begin
  select id into ch from public.chats where slug = 'welcome-discussion';
  g := '00000000-0000-0000-0000-00000000f001';
  insert into public.group_chats (id, name, created_by) values (g, 'Crew', '00000000-0000-0000-0000-0000000000a1');
  insert into public.group_members (group_id, user_id, role, last_read_at) values (g, '00000000-0000-0000-0000-0000000000a1', 'owner', now() - interval '1 day'), (g, '00000000-0000-0000-0000-0000000000a5', 'member', now() - interval '1 day');

  -- Ada posts two messages (made to look like an hour ago)
  insert into public.chat_posts (chat_id, author_id, body, created_at) values (ch, '00000000-0000-0000-0000-0000000000a4', 'one', now() - interval '3 hours'), (ch, '00000000-0000-0000-0000-0000000000a4', 'two', now() - interval '2 hours');
  insert into public.chat_reads (user_id, chat_id, last_read_at) select p.id, c.id, now() - interval '5 hours' from public.profiles p cross join public.chats c;
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  select unread into n from public.chat_unreads() where chat_id = ch;
  perform tests.eq('mia has 2 unread', n, 2);
  perform public.mark_chat_read(ch);
  select unread into n from public.chat_unreads() where chat_id = ch;
  perform tests.eq('mia has 0 unread after reading', n, 0);
  perform tests.eq('the lead cannot see affiliate chats in the counts', (select count(*) from public.chat_unreads() where chat_id in (select id from public.chats where min_role = 'member')), (select count(*) from public.chats where min_role = 'member'));
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('lena only counts lead chats', (select count(*) from public.chat_unreads()), (select count(*) from public.chats where min_role = 'lead'));
  perform tests.eq('lena has 2 unread', (select unread from public.chat_unreads() where chat_id = ch), 2);
  perform tests.logout();

  -- receipts: Ada sees that Mia read both, and when
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('ada sees mia in receipts', (select count(*) from public.read_receipts('chat', ch, now() - interval '4 hours') where user_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint);
  perform tests.eq('lena has not read', (select count(*) from public.read_receipts('chat', ch, now() - interval '4 hours') where user_id = '00000000-0000-0000-0000-0000000000a3'), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('the lead gets no receipts for affiliate chats', (select count(*) from public.read_receipts('chat', (select id from public.chats where min_role = 'member' limit 1), '-infinity')), 0::bigint);
  perform tests.eq('outsider gets no group receipts', (select count(*) from public.read_receipts('group', g, '-infinity')), 0::bigint);
  perform tests.logout();

  -- groups: reading logs once, again only when something new arrives
  insert into public.group_messages (group_id, author_id, body) values (g, '00000000-0000-0000-0000-0000000000a5', 'hi');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.mark_group_read(g);
  perform public.mark_group_read(g);
  perform tests.logout();
  perform tests.eq('read logged once', (select count(*) from public.chat_read_log where kind = 'group' and target = g and user_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint);
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('max sees mia read it', (select count(*) from public.read_receipts('group', g, '-infinity') where user_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint);
  perform tests.logout();

  -- GIF links must come from GIPHY
  perform tests.fails('only giphy links', format('insert into public.group_messages (group_id, author_id, body, image_url) values (%L, %L, %L, %L)', g, '00000000-0000-0000-0000-0000000000a5', 'GIF', 'https://evil.example/x.gif'), '23514');
  insert into public.group_messages (group_id, author_id, body, image_url) values (g, '00000000-0000-0000-0000-0000000000a5', 'GIF', 'https://media2.giphy.com/media/x/giphy.gif');
  perform tests.eq('giphy ok', (select count(*) from public.group_messages where image_url is not null), 1::bigint);

  -- nobody reads the log directly
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('log is private', (select count(*) from public.chat_read_log), 0::bigint);
  perform tests.logout();
end $$;
rollback;
