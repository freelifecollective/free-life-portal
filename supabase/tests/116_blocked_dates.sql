-- Phase 102: blocked dates and the Google link.
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

do $$ declare cid uuid; n integer; blocked date; begin
  insert into public.calls (title, starts_at) values ('Community call', now() + interval '3 days') returning id into cid;
  insert into public.registrations (call_id, name, first_name, last_name, email, referrer_id, claimed_by) values (cid, 'Lena L', 'Lena', 'L', 'lena@example.com', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.coach_settings (member_id, call_minutes, tz, min_notice_hours) values ('00000000-0000-0000-0000-0000000000a1', 30, 'UTC', 0);
  insert into public.coach_availability (member_id, weekday, start_min, end_min) select '00000000-0000-0000-0000-0000000000a1', d, 540, 660 from generate_series(0, 6) d;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  select (min(slot at time zone 'UTC'))::date + 2 into blocked from public.open_slots(14);
  select count(*) into n from public.open_slots(14) where (slot at time zone 'UTC')::date = blocked;
  perform tests.eq('before blocking: that day has times', n > 0, true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.coach_blocked_dates (member_id, day, note) values ('00000000-0000-0000-0000-0000000000a1', blocked, 'holiday');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  select count(*) into n from public.open_slots(14) where (slot at time zone 'UTC')::date = blocked;
  perform tests.eq('after blocking: no times that day', n, 0);
  perform tests.eq('other days still open', (select count(*) from public.open_slots(14) where (slot at time zone 'UTC')::date <> blocked) > 0, true);
  perform tests.eq('a lead cannot read the blocked dates', (select count(*) from public.coach_blocked_dates), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('another member cannot see them either', (select count(*) from public.coach_blocked_dates), 0::bigint);
  perform tests.logout();

  -- google link: nobody can read the token, but you can see that you are connected
  insert into public.google_calendar_links (member_id, refresh_token, email) values ('00000000-0000-0000-0000-0000000000a1', 'secret-token', 'mia@gmail.com');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the token itself is hidden', (select count(*) from public.google_calendar_links), 0::bigint);
  perform tests.eq('but you see you are connected', (select email from public.my_google_calendar()), 'mia@gmail.com');
  perform public.disconnect_google_calendar();
  perform tests.eq('disconnecting removes it', (select count(*) from public.my_google_calendar()), 0::bigint);
  perform tests.logout();
  perform tests.eq('and the link is gone', (select count(*) from public.google_calendar_links), 0::bigint);
end $$;
rollback;
