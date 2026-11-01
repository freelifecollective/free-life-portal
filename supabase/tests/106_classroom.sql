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

-- Classroom
do $$ declare c1 uuid; c2 uuid; l1 uuid; l2 uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.classroom_courses (title, audience, published) values ('Start here', 'everyone', true) returning id into c1;
  insert into public.classroom_courses (title, audience, published) values ('Affiliates only', 'affiliates', true) returning id into c2;
  insert into public.classroom_courses (title, audience, published) values ('Draft course', 'everyone', false);
  insert into public.classroom_lessons (course_id, title, vimeo_id, published, sort) values (c1, 'Welcome', '123456789', true, 1) returning id into l1;
  insert into public.classroom_lessons (course_id, title, published, sort) values (c1, 'Hidden lesson', false, 2);
  insert into public.classroom_lessons (course_id, title, published, sort) values (c2, 'Secret', true, 1) returning id into l2;
  perform tests.eq('the admin sees every course', (select count(*) from public.classroom_overview()), 3::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees only the open published course', (select count(*) from public.classroom_overview()), 1::bigint);
  perform tests.eq('and only its published lessons', (select lessons from public.classroom_overview() limit 1), 1);
  perform tests.eq('a lead cannot read affiliate lessons', (select count(*) from public.classroom_lessons where title = 'Secret'), 0::bigint);
  insert into public.classroom_progress (user_id, lesson_id) values ('00000000-0000-0000-0000-0000000000a3', l1);
  perform tests.eq('a lead can tick a lesson off', (select done from public.classroom_overview() limit 1), 1);
  perform tests.fails('a lead cannot tick off a lesson they cannot see', format($q$ insert into public.classroom_progress (user_id, lesson_id) values ('00000000-0000-0000-0000-0000000000a3', %L) $q$, l2), '42501');
  perform tests.fails('nobody can tick off for someone else', format($q$ insert into public.classroom_progress (user_id, lesson_id) values ('00000000-0000-0000-0000-0000000000a1', %L) $q$, l1), '42501');
  perform tests.fails('a lead cannot build a course', $q$ insert into public.classroom_courses (title) values ('Mine') $q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('an affiliate sees both published courses', (select count(*) from public.classroom_overview()), 2::bigint);
  perform tests.eq('and does not see my progress', (select done from public.classroom_overview() where title = 'Start here'), 0);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.fails('a bad Vimeo number is refused for admins too', format($q$ update public.classroom_lessons set vimeo_id = 'abc' where id = %L $q$, l1), '23514');
  perform tests.logout();
end $$;
rollback;
