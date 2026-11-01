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

-- Lead booking
update public.profiles set call_closer = true where id = '00000000-0000-0000-0000-0000000000a5';
do $$ declare cid uuid; n integer; first_slot timestamptz; bid uuid; hid uuid; begin
  insert into public.calls (title, starts_at) values ('Community call', now() + interval '3 days') returning id into cid;
  insert into public.registrations (call_id, name, first_name, last_name, email, referrer_id, claimed_by) values (cid, 'Lena L', 'Lena', 'L', 'lena@example.com', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.coach_settings (member_id, call_minutes, tz) values ('00000000-0000-0000-0000-0000000000a1', 30, 'UTC');
  insert into public.coach_availability (member_id, weekday, start_min, end_min) select '00000000-0000-0000-0000-0000000000a1', d, 540, 660 from generate_series(0, 6) d;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees who they book with', (select coach_name from public.booking_info()), 'Mia M');
  select count(*) into n from public.open_slots(14);
  perform tests.eq('there are free times (4 a day over about two weeks)', n >= 40, true);
  select min(slot) into first_slot from public.open_slots(14);
  bid := public.book_coaching_call(first_slot);
  perform tests.eq('the time is gone once booked', (select count(*) from public.open_slots(14) where slot = first_slot), 0::bigint);
  perform tests.fails('a taken time cannot be booked again', format('select public.book_coaching_call(%L)', first_slot), 'P0002');
  perform tests.fails('a time that is not offered cannot be booked', $q$ select public.book_coaching_call(now() + interval '5 days 3 hours 7 minutes') $q$, 'P0002');
  perform tests.eq('the lead sees their booking', (select count(*) from public.booked_calls), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the coach was told', (select count(*) from public.notifications where title = 'Lena L booked a coaching call'), 1::bigint);
  perform tests.eq('the coach sees it in their booked calls', (select count(*) from public.booked_calls where lead_id is not null), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform public.cancel_my_booking(bid);
  perform tests.eq('cancelling frees the time', (select count(*) from public.open_slots(14) where slot = first_slot), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('another member cannot read the open hours', (select count(*) from public.coach_availability), 0::bigint);
  perform tests.eq('a member with no coach has no free times', (select count(*) from public.open_slots(14)), 0::bigint);
  perform tests.logout();
  -- with an accepted hire, the lead books the closer's hours and the call goes to the closer
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  insert into public.coach_settings (member_id, call_minutes, tz) values ('00000000-0000-0000-0000-0000000000a5', 60, 'UTC');
  insert into public.coach_availability (member_id, weekday, start_min, end_min) select '00000000-0000-0000-0000-0000000000a5', d, 1020, 1140 from generate_series(0, 6) d;
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  hid := public.hire_closer('00000000-0000-0000-0000-0000000000a5', null);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.respond_closer_hire(hid, true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('the lead is now booking with the closer', (select with_closer from public.booking_info()), true);
  select min(slot) into first_slot from public.open_slots(14);
  perform tests.eq('and the closer own hours are offered (17:00 UTC)', extract(hour from first_slot at time zone 'UTC')::int, 17);
  bid := public.book_coaching_call(first_slot);
  perform tests.eq('the call is assigned to the closer', (select closer_id from public.booked_calls where id = bid), '00000000-0000-0000-0000-0000000000a5'::uuid);
  perform tests.logout();
end $$;
rollback;
