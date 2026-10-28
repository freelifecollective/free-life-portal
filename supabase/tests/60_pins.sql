-- Phase 5c rules: pinned posts.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';

do $$ declare pid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.chat_posts (chat_id, author_id, body) select id, auth.uid(), 'Hello' from public.chats where slug = 'wins' returning id into pid;
  perform tests.fails('an author cannot pin their own post', format('update public.chat_posts set pinned_at = now() where id = %L', pid), '42501');
  perform tests.fails('a member cannot call the pin function', format('select public.set_post_pinned(%L, true)', pid), '42501');
  perform tests.eq('editing the text still works', tests.rows(format('update public.chat_posts set body = %L where id = %L', 'Hello!', pid)), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform public.set_post_pinned(pid, true);
  perform tests.eq('an admin can pin', (select count(*) from public.chat_posts where pinned_at is not null), 1::bigint);
  perform public.set_post_pinned(pid, false);
  perform tests.eq('and unpin', (select count(*) from public.chat_posts where pinned_at is not null), 0::bigint);
  perform tests.logout();
end $$;
select tests.eq('social media chat has a subtitle', (select count(*) from public.chats where description is null), 0::bigint);
rollback;
