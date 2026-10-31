-- Facebook Follows.
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

do $$ declare n integer; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform public.fb_follow_add('https://www.facebook.com/maxpage');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('an affiliate sees the list', (select count(*) from public.fb_follow_list()), 1::bigint);
  perform public.fb_follow_set('00000000-0000-0000-0000-0000000000a5', true);
  perform tests.eq('the follow is counted', (select follows from public.fb_follow_list()), 1);
  perform tests.eq('and marked as mine', (select i_followed from public.fb_follow_list()), true);
  perform public.fb_follow_set('00000000-0000-0000-0000-0000000000a5', true);
  perform tests.eq('following twice still counts once', (select follows from public.fb_follow_list()), 1);
  perform public.fb_follow_set('00000000-0000-0000-0000-0000000000a5', false);
  perform tests.eq('undo works', (select follows from public.fb_follow_list()), 0);
  perform tests.fails('you cannot follow your own page', $q$select public.fb_follow_set('00000000-0000-0000-0000-0000000000a1', true)$q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees nothing', (select count(*) from public.fb_follow_list()), 0::bigint);
  perform tests.fails('a lead cannot list a page', $q$select public.fb_follow_add('https://www.facebook.com/x')$q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.fails('a page must be a facebook link', $q$select public.fb_follow_add('https://evil.example.com/x')$q$, '23514');
  perform tests.logout();
  -- the 50th follow takes the page off the list and tells the owner
  for i in 1..49 loop
    insert into public.signup_allowlist (email, role) values ('f' || i || '@example.com', 'member');
    insert into auth.users (id, email) values (('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'f' || i || '@example.com');
    insert into public.fb_follows (target_id, follower_id) values ('00000000-0000-0000-0000-0000000000a5', ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid);
  end loop;
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('49 follows: still listed', (select follows from public.fb_follow_list() where not is_me), 49);
  perform public.fb_follow_set('00000000-0000-0000-0000-0000000000a5', true);
  perform tests.eq('50 follows: off the list for others', (select count(*) from public.fb_follow_list()), 0::bigint);
  perform tests.logout();
  perform tests.eq('the owner was told', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and title like '%50 Facebook follows%'), 1::bigint);
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('and still sees their finished page', (select count(*) from public.fb_follow_list()), 1::bigint);
  perform tests.logout();
end $$;
rollback;
