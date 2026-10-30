-- Call closer reviews and stats.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('max@example.com','member'),('lena@example.com','lead'),('liz@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a6','liz@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Liz', last_name='Z', username='lizlead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  update public.profiles set call_closer = true where id = '00000000-0000-0000-0000-0000000000a5';
  insert into public.call_closer_details (member_id, calls_taken, counted_from) values ('00000000-0000-0000-0000-0000000000a5', '40+', now() - interval '10 days');
  perform tests.logout();
  -- Mia booked Max twice (one past, one future), Ada once (past)
  insert into public.booked_calls (member_id, lead_name, starts_at, closer_id) values
    ('00000000-0000-0000-0000-0000000000a1', 'Lead One', now() - interval '3 days', '00000000-0000-0000-0000-0000000000a5'),
    ('00000000-0000-0000-0000-0000000000a1', 'Lead Two', now() + interval '3 days', '00000000-0000-0000-0000-0000000000a5'),
    ('00000000-0000-0000-0000-0000000000a4', 'Lead Three', now() - interval '20 days', '00000000-0000-0000-0000-0000000000a5');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('only calls since the figure was set are counted', (select calls_counted from public.closer_stats('00000000-0000-0000-0000-0000000000a5')), 1);
  perform tests.eq('two members have booked them', (select members_booked from public.closer_stats('00000000-0000-0000-0000-0000000000a5')), 2);
  perform tests.eq('Mia booked them so she can review', (select viewer_booked from public.closer_stats('00000000-0000-0000-0000-0000000000a5')), true);
  insert into public.closer_reviews (closer_id, reviewer_id, rating, review) values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1', 5, 'Great call');
  perform tests.eq('the average shows', (select avg_rating from public.closer_stats('00000000-0000-0000-0000-0000000000a5')), 5.0);
  perform tests.fails('one review each', $q$insert into public.closer_reviews (closer_id, reviewer_id, rating) values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1', 4)$q$, '23505');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees no stats', (select count(*) from public.closer_stats('00000000-0000-0000-0000-0000000000a5')), 0::bigint);
  perform tests.eq('a lead sees no reviews', (select count(*) from public.closer_reviews), 0::bigint);
  perform tests.logout();
end $$;
rollback;
