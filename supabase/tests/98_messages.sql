-- Phase 5i rules: direct messages and read receipts.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('max@example.com','member'),('lena@example.com','lead'),('liz@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a6','liz@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Liz', last_name='Z', username='lizlead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';

do $$ declare mid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.direct_messages (sender_id, recipient_id, body) values (auth.uid(), '00000000-0000-0000-0000-0000000000a5', 'Hi Max') returning id into mid;
  perform tests.fails('you cannot send as someone else', format('insert into public.direct_messages (sender_id, recipient_id, body) values (%L, %L, %L)', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1', 'fake'), '42501');
  perform tests.fails('you cannot message yourself', format('insert into public.direct_messages (sender_id, recipient_id, body) values (auth.uid(), auth.uid(), %L)', 'me'), '42501');
  perform tests.fails('you cannot send a pre-read message', format('insert into public.direct_messages (sender_id, recipient_id, body, read_at) values (auth.uid(), %L, %L, now())', '00000000-0000-0000-0000-0000000000a5', 'x'), '42501');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the recipient got a notification', (select count(*) from public.notifications where kind = 'direct_message'), 1::bigint);
  perform tests.eq('it links to the conversation', (select url from public.notifications where kind = 'direct_message'), '/messages/miamember');
  perform tests.eq('peeking (just reading it) leaves it unread', (select read_at is null from public.direct_messages where id = mid), true);
  perform tests.fails('the recipient cannot edit the text', format('update public.direct_messages set body = %L where id = %L', 'changed', mid), '42501');
  perform tests.eq('opening the conversation marks it read', public.mark_conversation_read('00000000-0000-0000-0000-0000000000a1'), 1);
  perform tests.eq('and records when', (select read_at is not null from public.direct_messages where id = mid), true);
  perform tests.eq('reading again changes nothing', public.mark_conversation_read('00000000-0000-0000-0000-0000000000a1'), 0);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the sender sees it as read', (select read_at is not null from public.direct_messages where id = mid), true);
  perform tests.eq('the sender cannot mark their own message read', tests.rows(format('update public.direct_messages set read_at = null where id = %L', mid)), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an outsider (even an admin) cannot read their messages', (select count(*) from public.direct_messages), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('a lead cannot message another lead', format('insert into public.direct_messages (sender_id, recipient_id, body) values (auth.uid(), %L, %L)', '00000000-0000-0000-0000-0000000000a6', 'hi'), '42501');
  insert into public.direct_messages (sender_id, recipient_id, body) values (auth.uid(), '00000000-0000-0000-0000-0000000000a4', 'Hello admin');
  perform tests.eq('a lead can message an affiliate or admin', (select count(*) from public.direct_messages), 1::bigint);
  perform tests.logout();
end $$;
rollback;
