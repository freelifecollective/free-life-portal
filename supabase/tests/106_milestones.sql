-- Badges for chats answers, coaching calls and sales.
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('ada@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';

do $$
declare cid uuid; pid uuid; i integer; s jsonb;
begin
  select id into cid from public.chats limit 1;
  -- Max posts 3 questions; Mia answers them 120 times in all, plus 5 comments on her own post (which do not count)
  insert into public.chat_posts (chat_id, author_id, body) select cid, '00000000-0000-0000-0000-0000000000a5', 'Question ' || g from generate_series(1, 3) g;
  insert into public.chat_posts (chat_id, author_id, body) values (cid, '00000000-0000-0000-0000-0000000000a1', 'My own post') returning id into pid;
  for i in 1..120 loop
    insert into public.chat_comments (post_id, author_id, body) select id, '00000000-0000-0000-0000-0000000000a1', 'Answer ' || i from public.chat_posts where author_id = '00000000-0000-0000-0000-0000000000a5' order by body limit 1;
  end loop;
  for i in 1..5 loop insert into public.chat_comments (post_id, author_id, body) values (pid, '00000000-0000-0000-0000-0000000000a1', 'Replying to myself'); end loop;

  -- only an admin can log coaching calls and sales
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('members cannot log their own sales', 'insert into public.milestone_events (member_id, kind) values (auth.uid(), ''sale'')', '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.milestone_events (member_id, kind, logged_by) select '00000000-0000-0000-0000-0000000000a1', 'coaching', auth.uid() from generate_series(1, 23);
  insert into public.milestone_events (member_id, kind, logged_by) select '00000000-0000-0000-0000-0000000000a1', 'sale', auth.uid() from generate_series(1, 12);
  insert into public.milestone_events (member_id, kind, logged_by) select '00000000-0000-0000-0000-0000000000a5', 'sale', auth.uid() from generate_series(1, 4);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  s := public.badge_state();
  perform tests.eq('120 answers counted, own-post replies not', (s->'counts'->>'answers')::int, 120);
  perform tests.eq('the 100 answers badge', (s->'new') ? 'answers_100', true);
  perform tests.eq('but not 250', (s->'new') ? 'answers_250', false);
  perform tests.eq('first coaching call', (s->'new') ? 'coaching_1', true);
  perform tests.eq('coaching 10 and 20', ((s->'new') ? 'coaching_10') and ((s->'new') ? 'coaching_20'), true);
  perform tests.eq('not coaching 30 yet', (s->'new') ? 'coaching_30', false);
  perform tests.eq('first sale, 5 and 10', ((s->'new') ? 'sales_1') and ((s->'new') ? 'sales_5') and ((s->'new') ? 'sales_10'), true);
  perform tests.eq('sales 20 not yet', (s->'new') ? 'sales_20', false);
  perform tests.eq('no sales badge for 15 either', (s->'new') ? 'sales_15', false);
  perform tests.eq('a second look finds nothing new', jsonb_array_length(public.badge_state()->'new'), 0);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  s := public.badge_state();
  perform tests.eq('four sales: first sale only', ((s->'new') ? 'sales_1') and not ((s->'new') ? 'sales_5'), true);
  perform tests.logout();
end $$;
rollback;
