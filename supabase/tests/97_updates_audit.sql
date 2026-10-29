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

-- Important Updates: only admins post, nobody else replies, everyone reacts, counts of views, notifications
do $$ declare pid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('a member cannot post in Important Updates', format('insert into public.chat_posts (chat_id, author_id, body) select id, auth.uid(), %L from public.chats where slug = %L', 'hi', 'important-updates'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.chat_posts (chat_id, author_id, body) select id, auth.uid(), 'Big news: new feature live' from public.chats where slug = 'important-updates' returning id into pid;
  perform tests.eq('an admin can post', (select count(*) from public.chat_posts where id = pid), 1::bigint);
  insert into public.chat_comments (post_id, author_id, body) values (pid, auth.uid(), 'Details below');
  perform tests.eq('an admin can reply', (select count(*) from public.chat_comments), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('affiliates cannot reply there', format('insert into public.chat_comments (post_id, author_id, body) values (%L, auth.uid(), %L)', pid, 'hello'), '42501');
  insert into public.chat_reactions (post_id, user_id, kind) values (pid, auth.uid(), '👍');
  perform tests.eq('but they can react', (select count(*) from public.chat_reactions), 1::bigint);
  perform tests.eq('every affiliate got notified', (select count(*) from public.notifications where kind = 'important_update'), 1::bigint);
  perform public.mark_posts_seen(array[pid]);
  perform public.mark_posts_seen(array[pid]);
  perform tests.eq('seeing it twice counts once', (select views from public.post_view_counts(array[pid])), 1);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.mark_posts_seen(array[pid]);
  perform tests.eq('a second viewer makes two', (select views from public.post_view_counts(array[pid])), 2);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads do not get these notifications', (select count(*) from public.notifications where kind = 'important_update'), 0::bigint);
  perform tests.eq('leads do not see the counts', (select count(*) from public.post_view_counts(array[pid])), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('the author is not counted as a viewer', (select count(*) from public.chat_post_views where user_id = auth.uid()), 0::bigint);
  perform tests.logout();
end $$;

-- financing by country
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.financing_options (title, description, country, submitted_by) values ('Same name', 'x', 'Canada', auth.uid());
  insert into public.financing_options (title, description, country, submitted_by) values ('Same name', 'x', 'Germany', auth.uid());
  perform tests.eq('the same name can exist in two countries', (select count(*) from public.financing_options where title = 'Same name'), 2::bigint);
  perform tests.fails('but not twice in one country', format('insert into public.financing_options (title, description, country, submitted_by) values (%L, %L, %L, auth.uid())', ' same NAME ', 'x', 'Canada'), '23505');
  perform tests.fails('only the listed countries', format('insert into public.financing_options (title, description, country, submitted_by) values (%L, %L, %L, auth.uid())', 'Other', 'x', 'Mars'), '23514');
  perform tests.logout();
end $$;

-- the activity log and undo
do $$ declare cid uuid; aid bigint; r jsonb; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.calls (title, audience, starts_at) values ('Audit call', 'leads_open', now() + interval '10 days') returning id into cid;
  perform tests.eq('adding a call is logged', (select count(*) from public.audit_log where table_name = 'calls' and action = 'insert'), 1::bigint);
  update public.calls set title = 'Audit call v2' where id = cid;
  perform tests.eq('changing it is logged with what changed', (select changed_cols from public.audit_log where action = 'update' and table_name = 'calls'), array['title']);
  select id into aid from public.audit_log where action = 'update' and table_name = 'calls';
  r := public.undo_audit(aid);
  perform tests.eq('undoing a change works', (r->>'ok')::boolean, true);
  perform tests.eq('and restores the old value', (select title from public.calls where id = cid), 'Audit call');
  perform tests.eq('and cannot be undone twice', (public.undo_audit(aid)->>'ok')::boolean, false);
  delete from public.calls where id = cid;
  select id into aid from public.audit_log where action = 'delete' and table_name = 'calls';
  perform tests.eq('deleting is logged', aid is not null, true);
  r := public.undo_audit(aid);
  perform tests.eq('undoing a delete brings the call back', (select count(*) from public.calls where id = cid), 1::bigint);
  select id into aid from public.audit_log where action = 'insert' and table_name = 'calls';
  perform public.undo_audit(aid);
  perform tests.eq('undoing an add removes it', (select count(*) from public.calls where id = cid), 0::bigint);
  perform tests.eq('undoing is itself logged', (select count(*) from public.audit_log where action = 'undo'), 3::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('members cannot read the log', (select count(*) from public.audit_log), 0::bigint);
  perform tests.fails('members cannot undo', 'select public.undo_audit(1)', '42501');
  perform tests.logout();
end $$;

-- invites by admins are logged (who invited whom)
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.signup_allowlist (email, role, created_by) values ('newbie@example.com', 'member', auth.uid());
  perform tests.eq('inviting a member is in the log with the admin as actor', (select count(*) from public.audit_log where table_name = 'signup_allowlist' and actor_id = auth.uid()), 1::bigint);
  perform tests.logout();
end $$;
rollback;
