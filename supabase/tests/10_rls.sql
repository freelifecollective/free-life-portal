-- Foundation rules: roles, profiles, usernames, visibility helper, avatar storage.
begin;
create schema tests;

create function tests.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', r, true);
  execute format('set local role %I', r);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end $$;
create function tests.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;
-- run a statement as the current role and require a specific SQLSTATE
create function tests.fails(label text, stmt text, want_state text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = want_state then raise notice 'ok   % (%)', label, sqlstate; return; end if;
    raise exception 'FAIL % : expected %, got % (%)', label, want_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL % : statement succeeded but should have failed', label;
end $$;
-- rows affected by a statement run as the current role
create function tests.rows(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- fixtures: three people (inserting into auth.users fires the profile trigger)
insert into public.signup_allowlist (email) values ('lead@example.com'), ('member@example.com'), ('admin@example.com');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'lead@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'member@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@example.com');
update public.profiles set role = 'member' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-00000000000c';

-- ---------------------------------------------------------------- profile creation
select tests.eq('trigger created three profiles', (select count(*) from public.profiles), 3::bigint);
select tests.eq('new users default to lead', (select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'lead');
select tests.eq('rank is not a profile column', (select count(*) from information_schema.columns where table_name = 'profiles' and column_name ilike '%rank%'), 0::bigint);
select tests.eq('ranks seeded in order', (select string_agg(name, ',' order by sort) from public.ranks), '1A,2A,3A,4A,5A,6A,6A+');

-- ---------------------------------------------------------------- visibility helper
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000a');
  perform tests.eq('lead can see lead-level', public.can_see('lead'), true);
  perform tests.eq('lead cannot see member-level', public.can_see('member'), false);
  perform tests.eq('lead cannot see admin-level', public.can_see('admin'), false);
  perform tests.login('00000000-0000-0000-0000-00000000000b');
  perform tests.eq('member can see member-level', public.can_see('member'), true);
  perform tests.eq('member cannot see admin-level', public.can_see('admin'), false);
  perform tests.login('00000000-0000-0000-0000-00000000000c');
  perform tests.eq('admin can see everything', public.can_see('admin'), true);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('anonymous sees nothing', public.can_see('lead'), false);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- reading profiles
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000a');
  perform tests.eq('lead reads only own profile row', (select count(*) from public.profiles), 1::bigint);
  perform tests.login('00000000-0000-0000-0000-00000000000c');
  perform tests.eq('admin reads every profile', (select count(*) from public.profiles), 3::bigint);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.fails('anonymous cannot read profile cards', 'select * from public.profile_cards', '42501');
  perform tests.eq('anonymous reads no profiles', (select count(*) from public.profiles), 0::bigint);
  perform tests.fails('anonymous cannot call check_username', $q$select public.check_username('abc')$q$, '42501');
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- editing own profile
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000a');
  update public.profiles set first_name = 'Sarah', last_name = 'Chen', username = 'SarahChen2' where id = auth.uid();
  perform tests.eq('username stored lowercase', (select username::text from public.profiles where id = auth.uid()), 'sarahchen2');
  perform tests.fails('lead cannot promote self', $q$update public.profiles set role = 'admin' where id = auth.uid()$q$, '42501');
  perform tests.fails('lead cannot set own coach', $q$update public.profiles set coach_id = auth.uid() where id = auth.uid()$q$, '42501');
  perform tests.eq('editing someone else changes nothing',
    tests.rows($q$update public.profiles set first_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b'$q$), 0::bigint);
  perform tests.fails('cannot insert a profile directly', $q$insert into public.profiles (id) values (gen_random_uuid())$q$, '42501');
  perform tests.eq('cannot delete own profile', tests.rows($q$delete from public.profiles where id = auth.uid()$q$), 0::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- username rules
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000b');
  perform tests.fails('reserved username rejected', $q$update public.profiles set username = 'admin' where id = auth.uid()$q$, '23514');
  perform tests.fails('reserved check is case-insensitive', $q$update public.profiles set username = 'Welcome' where id = auth.uid()$q$, '23514');
  perform tests.fails('too short rejected', $q$update public.profiles set username = 'ab' where id = auth.uid()$q$, '23514');
  perform tests.fails('bad characters rejected', $q$update public.profiles set username = 'bad name!' where id = auth.uid()$q$, '23514');
  perform tests.fails('duplicate username rejected case-insensitively', $q$update public.profiles set username = 'SARAHCHEN2' where id = auth.uid()$q$, '23505');
  perform tests.fails('bad instagram handle rejected', $q$update public.profiles set instagram = 'no spaces' where id = auth.uid()$q$, '23514');
  perform tests.fails('short facebook handle rejected', $q$update public.profiles set facebook = 'abc' where id = auth.uid()$q$, '23514');
  update public.profiles set instagram = 'maya_p', facebook = 'maya.patel' where id = auth.uid();
  perform tests.eq('valid handles accepted', (select instagram || '/' || facebook from public.profiles where id = auth.uid()), 'maya_p/maya.patel');
  perform tests.eq('check_username ok', public.check_username('Fresh-Name')->>'ok', 'true');
  perform tests.eq('check_username taken', public.check_username('sarahchen2')->>'reason', 'taken');
  perform tests.eq('check_username reserved', public.check_username('portal')->>'reason', 'reserved');
  perform tests.eq('check_username short', public.check_username('ab')->>'reason', 'too_short');
  perform tests.eq('check_username chars', public.check_username('no spaces')->>'reason', 'bad_chars');
  perform tests.eq('own current username counts as available', public.check_username('sarahchen2')->>'reason', 'taken'); -- another user's name
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- onboarding completion
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000b');
  perform tests.fails('cannot finish onboarding without a name', $q$update public.profiles set onboarded_at = now() where id = auth.uid()$q$, '23514');
  update public.profiles set first_name = 'Maya', last_name = 'Patel', username = 'mayap', onboarded_at = now() where id = auth.uid();
  perform tests.eq('own current username is available to self', public.check_username('mayap')->>'ok', 'true');
  perform tests.fails('cannot undo onboarding', $q$update public.profiles set onboarded_at = null where id = auth.uid()$q$, '42501');
  perform tests.login('00000000-0000-0000-0000-00000000000a');
  perform tests.eq('profile cards list only onboarded members', (select count(*) from public.profile_cards), 1::bigint);
  perform tests.eq('profile cards expose no email or role', (select count(*) from information_schema.columns where table_name = 'profile_cards' and column_name in ('role', 'coach_id', 'email', 'onboarded_at')), 0::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- admin powers
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000c');
  update public.profiles set role = 'member', coach_id = '00000000-0000-0000-0000-00000000000b' where id = '00000000-0000-0000-0000-00000000000a';
  perform tests.eq('admin can change role', (select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'member');
  perform tests.eq('admin can set coach', (select coach_id::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), '00000000-0000-0000-0000-00000000000b');
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- reserved list and ranks are locked down
do $$ begin
  perform tests.login('00000000-0000-0000-0000-00000000000a');
  perform tests.eq('members cannot read the reserved list', (select count(*) from public.reserved_usernames), 0::bigint);
  perform tests.eq('members can read ranks', (select count(*) from public.ranks), 7::bigint);
  perform tests.eq('members cannot edit ranks', tests.rows($q$update public.ranks set name = 'X' where id = 1$q$), 0::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- avatar storage
do $$ begin
  perform tests.eq('avatars bucket is public and size limited', (select public::text || '/' || file_size_limit from storage.buckets where id = 'avatars'), 'true/2097152');
  perform tests.login('00000000-0000-0000-0000-00000000000a');
  insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar.jpg', auth.uid());
  perform tests.eq('can upload into own folder', (select count(*) from storage.objects where bucket_id = 'avatars'), 1::bigint);
  perform tests.fails('cannot upload into someone elses folder', $q$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar.jpg')$q$, '42501');
  perform tests.fails('cannot upload to the bucket root', $q$insert into storage.objects (bucket_id, name) values ('avatars', 'avatar.jpg')$q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-00000000000b');
  perform tests.eq('another member cannot delete it', tests.rows($q$delete from storage.objects where bucket_id = 'avatars'$q$), 0::bigint);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('anyone can read avatars', (select count(*) from storage.objects where bucket_id = 'avatars'), 1::bigint);
  perform tests.fails('anonymous cannot upload', $q$insert into storage.objects (bucket_id, name) values ('avatars', 'x/avatar.jpg')$q$, '42501');
  perform tests.logout();
end $$;

rollback;
