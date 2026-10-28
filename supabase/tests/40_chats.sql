-- Phase 5a rules: chats, posts, comments, reactions, votes.
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

-- people: member Mia, lead Lena, member Max (voter), admin Ada
insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead'),('ada@example.com','member'),('max@example.com','member');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),
  ('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';

create function tests.chat(s text) returns uuid language sql as $$ select id from public.chats where slug = s $$;

-- what each audience can see
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees the two New Members chats', (select count(*) from public.chats), 2::bigint);
  perform tests.eq('a lead sees one section', (select count(*) from public.chat_sections), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a member sees all ten chats', (select count(*) from public.chats), 10::bigint);
  perform tests.eq('a member sees both sections', (select count(*) from public.chat_sections), 2::bigint);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('visitors see no chats', (select count(*) from public.chats), 0::bigint);
  perform tests.logout();
end $$;

-- posting
do $$ declare pid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  insert into public.chat_posts (chat_id, author_id, body) values (tests.chat('wins'), auth.uid(), 'My first win') returning id into pid;
  perform tests.eq('a lead can post in Wins', (select count(*) from public.chat_posts), 1::bigint);
  perform tests.fails('a lead cannot post in an affiliates chat', format('insert into public.chat_posts (chat_id, author_id, body) values (%L, auth.uid(), %L)', tests.chat('ads'), 'hi'), '42501');
  perform tests.fails('nobody can post as someone else', format('insert into public.chat_posts (chat_id, author_id, body) values (%L, %L, %L)', tests.chat('wins'), '00000000-0000-0000-0000-0000000000a1', 'fake'), '42501');
  perform tests.fails('an empty post is refused', format('insert into public.chat_posts (chat_id, author_id, body) values (%L, auth.uid(), %L)', tests.chat('wins'), '   '), '23514');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a member sees the lead post', (select count(*) from public.chat_posts), 1::bigint);
  insert into public.chat_comments (post_id, author_id, body) values (pid, auth.uid(), 'Congrats!');
  insert into public.chat_reactions (post_id, user_id, kind) values (pid, auth.uid(), 'fire'), (pid, auth.uid(), 'like');
  perform tests.fails('an unknown reaction is refused', format('insert into public.chat_reactions values (%L, auth.uid(), %L)', pid, 'poop'), '23514');
  perform tests.eq('reaction recorded', (select count(*) from public.chat_reactions), 2::bigint);
  perform tests.eq('a member cannot delete someone elses post', tests.rows(format('delete from public.chat_posts where id = %L', pid)), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('the lead sees the comment', (select count(*) from public.chat_comments), 1::bigint);
  perform tests.eq('the author can edit own post', tests.rows(format('update public.chat_posts set body = %L, edited_at = now() where id = %L', 'My first win!', pid)), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an admin can delete any comment', tests.rows('delete from public.chat_comments'), 1::bigint);
  perform tests.logout();
end $$;

-- affiliates-only chat is invisible to leads
do $$ declare pid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.chat_posts (chat_id, author_id, body) values (tests.chat('ads'), auth.uid(), 'Members only') returning id into pid;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead cannot see affiliate posts', (select count(*) from public.chat_posts where body = 'Members only'), 0::bigint);
  perform tests.fails('a lead cannot react there', format('insert into public.chat_reactions values (%L, auth.uid(), %L)', pid, 'like'), '42501');
  perform tests.logout();
end $$;

-- voting on Verbiage/Objections
do $$ declare pid uuid; i int; uid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.chat_posts (chat_id, author_id, body) values (tests.chat('verbiage-objections'), auth.uid(), 'Say: I hear you, here is why...') returning id into pid;
  perform tests.fails('you cannot vote for your own answer', format('insert into public.chat_votes values (%L, auth.uid())', pid), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  insert into public.chat_votes values (pid, auth.uid());
  perform tests.fails('one vote per person', format('insert into public.chat_votes values (%L, auth.uid())', pid), '23505');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('15 or fewer votes is not listed yet', (select count(*) from public.top_responses), 0::bigint);
  perform tests.logout();
  -- 15 more voters (16 votes in total) added as the database owner
  for i in 1..15 loop
    uid := gen_random_uuid();
    insert into public.signup_allowlist (email, role) values ('v'||i||'@example.com', 'member');
    insert into auth.users (id, email) values (uid, 'v'||i||'@example.com');
    insert into public.chat_votes values (pid, uid);
  end loop;
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('more than 15 votes lists the answer', (select votes from public.top_responses where id = pid), 16);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads do not see the list', (select count(*) from public.top_responses), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('no votes in a normal chat', format('insert into public.chat_votes select id, auth.uid() from public.chat_posts where chat_id = %L limit 1', tests.chat('ads')), '42501');
  perform tests.logout();
end $$;
rollback;
