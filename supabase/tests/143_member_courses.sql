-- Member courses: Builder and Leader build them; the public page shows only what is published, and only free lessons in full.
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;


insert into public.signup_allowlist (email, role) values ('bo@example.com','member'),('sam@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1','bo@example.com'),('00000000-0000-0000-0000-0000000000c2','sam@example.com');
update public.profiles set first_name='Bo', last_name='B', username='bobuilder', onboarded_at=now(), plan=97 where id='00000000-0000-0000-0000-0000000000b1';
update public.profiles set first_name='Sam', last_name='S', username='samstarter', onboarded_at=now(), plan=47 where id='00000000-0000-0000-0000-0000000000c2';

do $$ declare bo uuid := '00000000-0000-0000-0000-0000000000b1'; sam uuid := '00000000-0000-0000-0000-0000000000c2'; c uuid;
begin
  perform tests.login(sam);
  perform tests.fails('Starter cannot make a course', format('insert into public.member_courses (owner_id, title, slug) values (%L, %L, %L)', sam, 'Mine', 'mine'), '42501');
  perform tests.logout();

  perform tests.login(bo);
  insert into public.member_courses (owner_id, title, slug, price_cents) values (bo, 'Healthy Habits', 'healthy-habits', 4900) returning id into c;
  insert into public.member_lessons (course_id, position, title, body, free_preview) values (c, 0, 'Welcome', 'Start here.', true), (c, 1, 'Lesson one', 'Paid content.', false);
  perform tests.logout();

  perform tests.eq('a draft course is not public', public.public_member_course('bobuilder', 'healthy-habits'), null::jsonb);
  perform tests.login(bo);
  update public.member_courses set published = true where id = c;
  perform tests.logout();
  perform tests.eq('a published course shows its price', (public.public_member_course('bobuilder', 'healthy-habits') ->> 'price_cents')::int, 4900);
  perform tests.eq('the free lesson shows in full', public.public_member_course('bobuilder', 'healthy-habits') -> 'lessons' -> 0 ->> 'body', 'Start here.');
  perform tests.eq('a paid lesson shows only its title', public.public_member_course('bobuilder', 'healthy-habits') -> 'lessons' -> 1 ->> 'body', null);

  perform tests.login(sam);
  perform tests.eq('others cannot read the lessons', (select count(*) from public.member_lessons where course_id = c), 0::bigint);
  perform tests.logout();
end $$;
rollback;
