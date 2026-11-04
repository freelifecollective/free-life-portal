-- Phase 191: quotes.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; t text;
begin
  perform tests.login(lena);
  perform tests.fails('a lead cannot save a quote', format('insert into public.quotes (user_id, data) values (%L, ''{}'')', lena), '42501');
  perform tests.logout();
  perform tests.login(mia);
  insert into public.quotes (user_id, data) values (mia, '{"lead":"Ana","lang":"es","lines":[{"key":"k8","tax":0,"shipping":0}]}') returning token into t;
  perform tests.eq('a quote gets a long link code', char_length(t) >= 20, true);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('anyone with the link can open that quote', (public.get_quote(t))->>'lead', 'Ana');
  perform tests.eq('a wrong code finds nothing', public.get_quote('0123456789abcdef0123456789') is null, true);
  perform tests.eq('and cannot list quotes', (select count(*) from public.quotes), 0::bigint);
  perform tests.logout();
  perform tests.login(mia);
  perform public.queue_quote_email(t, 'Ana@Example.com', 'Ana');
  perform tests.logout();
  perform tests.eq('the email waits in the outbox', (select count(*) from public.email_outbox where template = 'quote_share' and to_email = 'ana@example.com'), 1::bigint);
  perform tests.login(mia);
  perform tests.fails('only to a real address', format('select public.queue_quote_email(%L, ''not-an-email'', ''x'')', t), '22023');
  perform tests.fails('only for your own quote', 'select public.queue_quote_email(''0123456789abcdef0123456789'', ''a@b.co'', ''x'')', '42501');
  perform tests.logout();
  perform tests.login(lena);
  perform tests.fails('a lead cannot email quotes', format('select public.queue_quote_email(%L, ''a@b.co'', ''x'')', t), '42501');
  perform tests.logout();
end $$;
do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; t text; z text; k integer;
begin
  -- a time zone where it is past 9 in the morning right now, so the test does not depend on the hour it runs
  select zz into z from unnest(array['UTC', 'Asia/Singapore', 'America/Los_Angeles']) zz where extract(hour from now() at time zone zz) >= 9 limit 1;
  insert into public.member_prefs (member_id, tz) values (mia, z) on conflict (member_id) do update set tz = excluded.tz;
  insert into public.quotes (user_id, data, sent_at) values (mia, '{"lead":"Ana","lang":"en","country":"United States","lines":[{"name":"K8","tax":0,"shipping":0}]}', now() - interval '2 days') returning token into t;
  perform tests.eq('nothing is due after 2 days', public.queue_quote_followups(), 0);
  update public.quotes set sent_at = now() - interval '3 days 1 hour' where token = t;
  perform tests.eq('a nudge after 3 days', public.queue_quote_followups(), 1);
  perform tests.eq('it names the lead', (select count(*) from public.notifications where user_id = mia and kind = 'quote_followup' and title like '%Ana%'), 1::bigint);
  perform tests.eq('and does not repeat', public.queue_quote_followups(), 0);
  update public.quotes set sent_at = now() - interval '7 days 1 hour' where token = t;
  perform tests.eq('a nudge after 7 days', public.queue_quote_followups(), 1);
  update public.quotes set sent_at = now() - interval '10 days 1 hour' where token = t;
  perform tests.eq('a nudge after 10 days', public.queue_quote_followups(), 1);
  perform tests.eq('and then no more', public.queue_quote_followups(), 0);
  update public.quotes set nudges = 0, sent_at = now() - interval '4 days' where token = t;
  perform tests.login(mia);
  perform public.set_quote_followed_up(t, true);
  perform tests.logout();
  perform tests.eq('followed up quotes are left alone', public.queue_quote_followups(), 0);
end $$;
rollback;
