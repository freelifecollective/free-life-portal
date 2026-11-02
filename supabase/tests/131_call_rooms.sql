-- Phase 154: calls held inside the portal.
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

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; b1 uuid; b2 uuid; r record; n int;
begin
  -- Lena (lead) booked Mia (coach), and a second call that Max (call closer, $40 a call) takes for Mia
  insert into public.call_closer_details (member_id, price_per_call_cents) values (max, 4000);
  insert into public.booked_calls (member_id, lead_name, starts_at, lead_id) values (mia, 'Lena', now() - interval '5 minutes', lena) returning id into b1;
  insert into public.booked_calls (member_id, lead_name, starts_at, lead_id, closer_id) values (mia, 'Lena', now() - interval '1 minute', lena, max) returning id into b2;
  perform tests.login(lena);
  perform tests.eq('the lead sees their call as the lead', (select my_role from public.room_info(b1)), 'lead');
  perform tests.eq('and the room is open', (select open_now from public.room_info(b1)), true);
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('the coach is the host of their own call', (select my_role from public.room_info(b1)), 'host');
  perform tests.eq('but not of the call the closer takes', (select count(*) from public.room_info(b2)), 0::bigint);
  perform tests.logout();
  perform tests.login(ada);
  perform tests.eq('nobody else can open it', (select count(*) from public.room_info(b1)), 0::bigint);
  perform tests.fails('or beat it', format('select * from public.room_beat(%L)', b1), '42501');
  perform tests.logout();

  -- one person alone does not count
  perform tests.login(lena); perform public.room_beat(b1); perform tests.logout();
  perform tests.eq('alone, nothing is counted', (select together_secs from public.booked_calls where id = b1), 0);
  -- both there: time is counted, then it completes once enough has passed
  perform tests.login(mia); perform public.room_beat(b1); perform tests.logout();
  update public.booked_calls set together_secs = 280, together_checked_at = now() - interval '30 seconds' where id = b1;
  perform tests.login(lena); perform public.room_beat(b1); perform tests.logout();
  perform tests.eq('five minutes together completes the call', (select auto_completed from public.booked_calls where id = b1), true);
  perform tests.eq('it is marked as having taken place', (select outcome from public.booked_calls where id = b1), 'took_place');
  perform tests.eq('and counted as a coaching call for the coach', (select count(*) from public.milestone_events where member_id = mia and kind = 'coaching'), 1::bigint);
  perform tests.eq('a coach taking their own call is owed nothing', (select pay_call_cents from public.booked_calls where id = b1), null);
  -- beating again does not count it twice
  perform tests.login(mia); perform public.room_beat(b1); perform tests.logout();
  perform tests.eq('still just one coaching call', (select count(*) from public.milestone_events where member_id = mia and kind = 'coaching'), 1::bigint);

  -- the call closer: the call price is added to what they are owed
  perform tests.login(lena); perform public.room_beat(b2); perform tests.logout();
  perform tests.login(max); perform public.room_beat(b2); perform tests.logout();
  update public.booked_calls set together_secs = 290, together_checked_at = now() - interval '20 seconds' where id = b2;
  perform tests.login(max); perform public.room_beat(b2); perform tests.logout();
  perform tests.eq('the closer call completed', (select auto_completed from public.booked_calls where id = b2), true);
  perform tests.eq('the call price is now owed to the closer', (select pay_call_cents from public.booked_calls where id = b2), 4000);
  perform tests.eq('in dollars', (select pay_currency from public.booked_calls where id = b2), 'USD');
  perform tests.eq('the closer gets the coaching call, not the coach', (select count(*) from public.milestone_events where member_id = max and kind = 'coaching'), 1::bigint);
  perform tests.eq('the closer was told', (select count(*) from public.notifications where user_id = max and title like 'Call completed%'), 1::bigint);

  -- a call that has not opened yet cannot be counted
  insert into public.booked_calls (member_id, lead_name, starts_at, lead_id) values (mia, 'Lena', now() + interval '2 days', lena) returning id into b1;
  perform tests.login(lena); perform public.room_beat(b1); perform tests.logout();
  perform tests.eq('too early to count', (select count(*) from public.call_presence where booked_call_id = b1), 0::bigint);
end $$;
rollback;
