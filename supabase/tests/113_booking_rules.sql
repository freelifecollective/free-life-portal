-- Phase 93-94: booking rules and old replies becoming messages.
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

do $$ declare cid uuid; n integer; n2 integer; ch uuid; post uuid; moved integer; begin
  insert into public.calls (title, starts_at) values ('Community call', now() + interval '3 days') returning id into cid;
  insert into public.registrations (call_id, name, first_name, last_name, email, referrer_id, claimed_by) values (cid, 'Lena L', 'Lena', 'L', 'lena@example.com', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.coach_settings (member_id, call_minutes, tz) values ('00000000-0000-0000-0000-0000000000a1', 30, 'UTC');
  insert into public.coach_availability (member_id, weekday, start_min, end_min) select '00000000-0000-0000-0000-0000000000a1', d, 540, 660 from generate_series(0, 6) d;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  select count(*) into n from public.open_slots(60);
  perform tests.eq('default: 14 days ahead at most', (select count(distinct (slot at time zone 'UTC')::date) from public.open_slots(60)) <= 15, true);
  perform tests.logout();

  -- a 5 minute step doubles up the starts; a 60 minute step halves them
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  update public.coach_settings set interval_minutes = 60;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  select count(*) into n2 from public.open_slots(14);
  perform tests.eq('60 minute spacing gives 2 starts a day, fewer than 4', n2 < n, true);
  perform tests.logout();

  -- notice of 7 days and a 7 day range leaves nothing
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  update public.coach_settings set interval_minutes = null, min_notice_hours = 168, max_days_ahead = 7;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('notice longer than the range: nothing', (select count(*) from public.open_slots(60)), 0::bigint);
  perform tests.logout();

  -- a daily limit of 1 and a buffer
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  update public.coach_settings set min_notice_hours = 2, max_days_ahead = 14, max_per_day = 1;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform public.book_coaching_call((select min(slot) from public.open_slots(14)));
  perform tests.eq('one a day: that day is full', (select count(*) from public.open_slots(14) where (slot at time zone 'UTC')::date = (select (starts_at at time zone 'UTC')::date from public.booked_calls limit 1)), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('bad step refused', 'update public.coach_settings set interval_minutes = 7', '23514');
  perform tests.fails('bad range refused', 'update public.coach_settings set max_days_ahead = 90', '23514');
  perform tests.logout();

  -- old replies become messages that quote their post
  select id into ch from public.chats where mode = 'conversation' limit 1;
  insert into public.chat_posts (chat_id, author_id, body) values (ch, '00000000-0000-0000-0000-0000000000a1', 'the post') returning id into post;
  insert into public.chat_comments (post_id, author_id, body) values (post, '00000000-0000-0000-0000-0000000000a5', 'an old reply');
  -- the same statement 0076 runs
  alter table public.chat_posts disable trigger chat_posts_push;
  with moved as (
    delete from public.chat_comments c using public.chat_posts p, public.chats chh where p.id = c.post_id and chh.id = p.chat_id and chh.mode = 'conversation'
    returning c.post_id, c.author_id, c.body, c.created_at
  )
  insert into public.chat_posts (chat_id, author_id, body, created_at, reply_to) select p.chat_id, m.author_id, m.body, m.created_at, m.post_id from moved m join public.chat_posts p on p.id = m.post_id;
  alter table public.chat_posts enable trigger chat_posts_push;
  perform tests.eq('the reply is now a message that quotes the post', (select count(*) from public.chat_posts where body = 'an old reply' and reply_to = post), 1::bigint);
  perform tests.eq('no old comment is left', (select count(*) from public.chat_comments where body = 'an old reply'), 0::bigint);
  perform tests.eq('moving it sent no push', (select count(*) from public.notifications where kind = 'chat_message' and body like '%an old reply%'), 0::bigint);
end $$;
rollback;
