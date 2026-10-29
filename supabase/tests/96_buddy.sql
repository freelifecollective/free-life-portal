-- Phase 7 rules: Accountability Buddy matching and pool.
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

insert into public.signup_allowlist (email, role) values ('a@x.com','member'),('b@x.com','member'),('c@x.com','member'),('d@x.com','member'),('e@x.com','member'),('lead@x.com','lead');
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000b1','a@x.com'),('00000000-0000-0000-0000-0000000000b2','b@x.com'),('00000000-0000-0000-0000-0000000000b3','c@x.com'),
 ('00000000-0000-0000-0000-0000000000b4','d@x.com'),('00000000-0000-0000-0000-0000000000b5','e@x.com'),('00000000-0000-0000-0000-0000000000b6','lead@x.com');
update public.profiles set first_name = 'P' || right(id::text, 1), last_name = 'Q', username = 'user' || right(id::text, 1), onboarded_at = now() where id::text like '00000000-0000-0000-0000-0000000000b%';

create function tests.answers(tz text, gender text, age int, rankpref text, samegender text, goals text, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('tz', jsonb_build_object('city', 'x', 'tz', tz), 'chrono', 'Night owl', 'checkin', 'Daily', 'connect', 'Video calls', 'gender', gender,
    'age', age, 'kids', jsonb_build_array('No kids'), 'samegender', samegender, 'joined', '1 to 3 months ago', 'ordered', '1 to 3 months ago', 'rank', '3A', 'rankpref', rankpref,
    'goals', jsonb_build_array(goals), 'success', jsonb_build_array('x'), 'derail', jsonb_build_array('x'), 'want', jsonb_build_array('x'), 'style', jsonb_build_array('A gentle nudge'),
    'recharge', 'A bit of both', 'decide', 'I go with my gut', 'plan', 'I like a plan', 'friends', jsonb_build_array('Funny'), 'interests', jsonb_build_array('Fitness', 'Music'),
    'weekend', jsonb_build_array('x'), 'values', jsonb_build_array('Honesty'), 'about', 'about me about me', 'working', 'working on things') || extra $$;
grant execute on function tests.answers(text, text, int, text, text, text, jsonb) to authenticated;

do $$ declare r jsonb; n integer; begin
  -- B1 (me): rank 3, New York. B2: rank 4, Chicago (close). B3: rank 7, far in rank. B4: Sydney (far away). B5: rank 3, but wants same gender only and I am a different gender.
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  r := public.ab_save(tests.answers('America/New_York', 'Female', 32, 'It does not matter', 'No preference', 'Leave my job'), 3::smallint);
  perform tests.eq('answering all 26 questions completes the profile', (r->>'complete')::boolean, true);
  perform tests.eq('and puts the member in the pool', (select pool_status from public.ab_profiles), 'in_pool');
  perform tests.eq('their rank is saved privately', (select rank_id from public.member_private), 3::smallint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b2');
  perform public.ab_save(tests.answers('America/Chicago', 'Female', 34, 'It does not matter', 'No preference', 'Leave my job'), 4::smallint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b3');
  perform public.ab_save(tests.answers('America/New_York', 'Female', 33, 'It does not matter', 'No preference', 'Leave my job'), 7::smallint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b4');
  perform public.ab_save(tests.answers('Australia/Sydney', 'Female', 32, 'It does not matter', 'No preference', 'Leave my job'), 3::smallint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b5');
  perform public.ab_save(tests.answers('America/New_York', 'Male', 32, 'It does not matter', 'Yes, same gender', 'Travel the world'), 3::smallint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  perform tests.eq('rank 7 is more than two ranks away: not offered', (select count(*) from public.ab_matches_for_me() where username = 'user3'), 0::bigint);
  perform tests.eq('a stated same-gender preference applies in both directions', (select count(*) from public.ab_matches_for_me() where username = 'user5'), 0::bigint);
  perform tests.eq('someone far away in time is listed but not in the top five', (select is_top from public.ab_matches_for_me() where username = 'user4'), false);
  perform tests.eq('a nearby, similar member is a top match', (select is_top from public.ab_matches_for_me() where username = 'user2'), true);
  perform tests.eq('the match has a sensible percentage', (select score between 50 and 100 from public.ab_matches_for_me() where username = 'user2'), true);
  perform tests.eq('and plain reasons, at most three', (select cardinality(reasons) between 1 and 3 from public.ab_matches_for_me() where username = 'user2'), true);
  perform tests.eq('reasons never mention rank or age', (select count(*) from public.ab_matches_for_me() m, unnest(m.reasons) x where x ~* '\m(rank|age|years?)\M' or x ~ '[0-9]{2}'), 0::bigint);
  perform tests.eq('the top match ranks above the far-away one', (select (select score from public.ab_matches_for_me() where username = 'user2') > (select score from public.ab_matches_for_me() where username = 'user4')), true);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000b6');
  perform tests.eq('leads get nothing', (select count(*) from public.ab_matches_for_me()), 0::bigint);
  perform tests.fails('leads cannot save answers', format('select public.ab_save(%L::jsonb, 3::smallint)', '{}'), '42501');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000b2');
  perform tests.eq('others cannot read my answers', (select count(*) from public.ab_profiles where member_id <> auth.uid()), 0::bigint);
  perform tests.eq('nor anyone elses rank', (select count(*) from public.member_private where member_id <> auth.uid()), 0::bigint);
  perform tests.logout();

  -- pausing removes you from others' results
  perform tests.login('00000000-0000-0000-0000-0000000000b2');
  perform public.ab_set_status('paused');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  perform tests.eq('a paused member is not offered', (select count(*) from public.ab_matches_for_me() where username = 'user2'), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b2');
  perform public.ab_set_status('in_pool');
  perform tests.logout();

  -- choosing a buddy
  perform tests.login('00000000-0000-0000-0000-0000000000b1');
  r := public.ab_choose('00000000-0000-0000-0000-0000000000b2');
  perform tests.eq('choosing works', (r->>'ok')::boolean, true);
  perform tests.eq('both leave the pool', (select count(*) from public.ab_profiles where pool_status = 'matched'), 1::bigint);
  perform tests.eq('and I can see who my buddy is', (select username from public.ab_my_buddy()), 'user2');
  perform tests.eq('chosen people are no longer offered to anyone', (select count(*) from public.ab_matches_for_me()), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000b2');
  perform tests.eq('the chosen person is told', (select count(*) from public.notifications where kind = 'accountability'), 1::bigint);
  perform tests.eq('and sees their buddy too', (select username from public.ab_my_buddy()), 'user1');
  -- coming back: confirming the rank puts them back in the pool and resets the clock
  perform public.ab_confirm_rank(5::smallint);
  perform tests.eq('confirming a rank brings them back to the pool', (select pool_status from public.ab_profiles), 'in_pool');
  perform tests.eq('and saves the new rank', (select rank_id from public.member_private), 5::smallint);
  perform tests.logout();
end $$;
rollback;
