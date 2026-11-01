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

-- Closer hub
update public.profiles set call_closer = true where id = '00000000-0000-0000-0000-0000000000a1';
do $$ declare c1 uuid; c2 uuid; ct jsonb; n int; waiting boolean; begin
  insert into public.call_closer_details (member_id, price_per_call_cents) values ('00000000-0000-0000-0000-0000000000a1', 5000);
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.closer_pay_rules (closer_id, rank_from, rank_to, kind, amount) values ('00000000-0000-0000-0000-0000000000a1', 1, 3, 'flat', 5000);
  perform tests.fails('a closer cannot write rules for someone else', $q$ insert into public.closer_pay_rules (closer_id, rank_from, rank_to, kind, amount) values ('00000000-0000-0000-0000-0000000000a5', 1, 7, 'flat', 1) $q$, '42501');
  perform tests.logout();
  -- two calls for closer a1: one past, one coming up
  insert into public.booked_calls (member_id, lead_name, starts_at, closer_id) values ('00000000-0000-0000-0000-0000000000a5', 'Past Lead', now() - interval '2 days', '00000000-0000-0000-0000-0000000000a1') returning id into c1;
  insert into public.booked_calls (member_id, lead_name, starts_at, closer_id) values ('00000000-0000-0000-0000-0000000000a5', 'Future Lead', now() + interval '2 days', '00000000-0000-0000-0000-0000000000a1') returning id into c2;
  insert into public.member_private (member_id, rank_id) values ('00000000-0000-0000-0000-0000000000a5', 2);
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the closer sees the member rank and price for pay', (select rank_id from public.closer_call_inputs(c1)), 2::smallint);
  perform public.closer_save_call(c1, 'took_place', 2, 5000, 10000, 'USD', '{"K8": 2}'::jsonb);
  perform tests.eq('the call is marked as taken', (select outcome from public.booked_calls where id = c1), 'took_place');
  perform tests.eq('the products are saved', (select qty from public.booked_call_products where booked_call_id = c1 and product = 'K8'), 2::smallint);
  perform public.closer_save_call(c1, 'took_place', 2, 5000, 5000, 'USD', '{"K8": 1}'::jsonb);
  perform tests.eq('the products can be changed later', (select qty from public.booked_call_products where booked_call_id = c1), 1::smallint);
  perform tests.fails('a call that has not happened cannot be recorded', format($q$ select public.closer_save_call(%L, 'took_place', 1, 0, 0, 'USD', '{}') $q$, c2), '42501');
  perform public.closer_mark_paid(c1, true);
  perform tests.eq('paid means the full amount', (select paid_cents from public.booked_calls where id = c1), 10000);
  perform public.closer_save_call(c1, 'took_place', 2, 5000, 10000, 'USD', '{"K8": 2}'::jsonb);
  perform tests.eq('adding products after payment leaves the extra owing', (select pay_call_cents + pay_products_cents - paid_cents from public.booked_calls where id = c1), 5000);
  perform public.closer_mark_paid(c1, false);
  perform tests.eq('paid can be undone', (select paid_cents from public.booked_calls where id = c1), 0);
  perform public.closer_save_call(c1, 'no_show', null, 0, 0, null, '{}');
  perform tests.eq('a call that did not happen owes nothing', (select coalesce(pay_call_cents, 0) + coalesce(pay_products_cents, 0) from public.booked_calls where id = c1), 0);
  perform tests.eq('and clears the products', (select count(*) from public.booked_call_products where booked_call_id = c1), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead cannot save a call', (select count(*) from public.booked_calls), 0::bigint);
  perform tests.logout();
  -- pausing and the waiting list
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.set_closer_paused(true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('a paused closer cannot be hired', $q$ select public.hire_closer('00000000-0000-0000-0000-0000000000a1', 1) $q$, 'P0001');
  perform tests.eq('the list shows who is paused', (select paused from public.call_closers_directory() limit 1), true);
  waiting := public.closer_waitlist_toggle('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('joining the waiting list', waiting, true);
  perform tests.eq('the list shows I am waiting', (select on_waitlist from public.call_closers_directory() limit 1), true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.set_closer_paused(false);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('restarting tells the waiting list', (select count(*) from public.notifications where title like '% is booking again'), 1::bigint);
  perform tests.eq('and clears it', (select on_waitlist from public.call_closers_directory() limit 1), false);
  perform tests.eq('a closer can be hired again', public.hire_closer('00000000-0000-0000-0000-0000000000a1', 1) is not null, true);
  perform tests.logout();
end $$;
rollback;
