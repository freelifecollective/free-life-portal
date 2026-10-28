-- Phase 4 rules: landing pages, their pictures, referral tracking and the shared counter.
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

-- people: two members (one onboarded, one not), a lead, an admin
insert into public.signup_allowlist (email, role) values ('mia@example.com', 'member'), ('new@example.com', 'member'), ('lena@example.com', 'lead'), ('ada@example.com', 'member');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'mia@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'new@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'lena@example.com'),
  ('00000000-0000-0000-0000-0000000000a4', 'ada@example.com');
update public.profiles set first_name = 'Mia', last_name = 'Member', username = 'miamember', instagram = 'mia.m', facebook = 'mia.member.fb',
  avatar_url = 'https://x.test/mia.jpg', avatar_kind = 'upload', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name = 'Nell', last_name = 'Notdone', username = 'nelldone' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set first_name = 'Lena', last_name = 'Lead', username = 'lenalead', avatar_url = 'https://x.test/lena.jpg', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name = 'Ada', last_name = 'Admin', username = 'adaadmin', role = 'admin', onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000a4';

insert into public.calls (id, title, audience, starts_at, pinned) values
  ('11111111-1111-1111-1111-111111111111', 'Later open call', 'leads_open', now() + interval '9 days', false),
  ('22222222-2222-2222-2222-222222222222', 'Sooner open call', 'leads_open', now() + interval '2 days', false),
  ('33333333-3333-3333-3333-333333333333', 'Masterclass', 'affiliates_only', now() + interval '1 day', false);

-- ---------------------------------------------------------------- reserved names cover every top-level page
select tests.eq('register is reserved', public.is_reserved_username('Register'), true);
select tests.eq('calendar and admin are reserved', public.is_reserved_username('calendar') and public.is_reserved_username('admin'), true);

-- ---------------------------------------------------------------- what visitors see of a member
do $$ declare j jsonb; begin
  perform tests.login(null, 'anon');
  j := public.public_landing('MiaMember');
  perform tests.eq('a member page shows first name', j->>'first_name', 'Mia');
  perform tests.eq('and last name', j->>'last_name', 'Member');
  perform tests.eq('the page uses the profile picture', j->>'photo_url', 'https://x.test/mia.jpg');
  perform tests.eq('the page uses the profile Instagram', j->>'instagram', 'mia.m');
  perform tests.eq('the page uses the profile Facebook', j->>'facebook', 'mia.member.fb');
  perform tests.eq('nothing private is exposed', (select count(*) from jsonb_object_keys(j) k where k in ('email', 'role', 'coach_id', 'onboarded_at')), 0::bigint);
  perform tests.eq('a lead has no page', public.public_landing('lenalead') is null, true);
  perform tests.eq('a member who has not finished setup has no page', public.public_landing('nelldone') is null, true);
  perform tests.eq('an unknown name has no page', public.public_landing('nobody') is null, true);
  perform tests.eq('admins have pages too', (public.public_landing('adaadmin'))->>'first_name', 'Ada');
  perform tests.eq('visitors cannot read landing settings directly', (select count(*) from public.landing_pages), 0::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- a member's own page settings
do $$ declare j jsonb; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.landing_pages (member_id, photo_url, instagram, facebook) values (auth.uid(), 'https://x.test/page.jpg', 'page.only', '');
  perform tests.logout();
  perform tests.login(null, 'anon');
  j := public.public_landing('miamember');
  perform tests.eq('a page photo replaces the profile one', j->>'photo_url', 'https://x.test/page.jpg');
  perform tests.eq('a page Instagram replaces the profile one', j->>'instagram', 'page.only');
  perform tests.eq('an empty page Facebook hides it', j->'facebook' = 'null'::jsonb, true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  update public.landing_pages set instagram = null where member_id = auth.uid();
  perform tests.eq('clearing the override falls back to the profile', (public.public_landing('miamember'))->>'instagram', 'mia.m');
  perform tests.fails('a bad handle is refused', $q$update public.landing_pages set instagram = 'no spaces' where member_id = auth.uid()$q$, '23514');
  perform tests.fails('a bad theme is refused', $q$update public.landing_pages set theme = 'pink' where member_id = auth.uid()$q$, '23514');
  perform tests.fails('cannot create a page for someone else', $q$insert into public.landing_pages (member_id) values ('00000000-0000-0000-0000-0000000000a4')$q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('a lead cannot create a landing page', $q$insert into public.landing_pages (member_id) values (auth.uid())$q$, '42501');
  perform tests.eq('a lead cannot read members'' page settings', (select count(*) from public.landing_pages), 0::bigint);
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an admin can read page settings', (select count(*) from public.landing_pages), 1::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- page pictures
do $$ begin
  perform tests.eq('the landing bucket is public with size and type limits', (select public::text || '/' || file_size_limit || '/' || array_length(allowed_mime_types, 1) from storage.buckets where id = 'landing'), 'true/3145728/3');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into storage.objects (bucket_id, name, owner) values ('landing', '00000000-0000-0000-0000-0000000000a1/photo.jpg', auth.uid());
  perform tests.eq('a member can upload into their own folder', (select count(*) from storage.objects where bucket_id = 'landing'), 1::bigint);
  perform tests.fails('not into someone else''s folder', $q$insert into storage.objects (bucket_id, name) values ('landing', '00000000-0000-0000-0000-0000000000a4/photo.jpg')$q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('a lead cannot upload page pictures', $q$insert into storage.objects (bucket_id, name) values ('landing', '00000000-0000-0000-0000-0000000000a3/photo.jpg')$q$, '42501');
  perform tests.eq('another person cannot delete a page picture', tests.rows($q$delete from storage.objects where bucket_id = 'landing'$q$), 0::bigint);
  perform tests.logout();
  perform tests.login(null, 'anon');
  perform tests.eq('anyone can see a page picture', (select count(*) from storage.objects where bucket_id = 'landing'), 1::bigint);
  perform tests.logout();
end $$;

-- ---------------------------------------------------------------- the shared counter and referrals
do $$ declare r jsonb; begin
  perform tests.login(null, 'anon');
  perform tests.eq('before anyone registers, the next call has zero', ((public.next_public_call())->>'registered')::int, 0);
  perform tests.eq('the next call is the soonest open one', (public.next_public_call())->>'title', 'Sooner open call');
  r := public.register_for_call('22222222-2222-2222-2222-222222222222', 'Pat', 'One', 'pat1@example.com', true, 'MIAMEMBER');
  perform tests.eq('registering through a member page works', (r->>'ok')::boolean, true);
  perform public.register_for_call('22222222-2222-2222-2222-222222222222', 'Pat', 'Two', 'pat2@example.com', true, 'nobody-here');
  perform public.register_for_call('22222222-2222-2222-2222-222222222222', 'Pat', 'Three', 'pat3@example.com', true, 'lenalead');
  perform public.register_for_call('22222222-2222-2222-2222-222222222222', 'Pat', 'One Again', 'PAT1@example.com', true, 'adaadmin');
  perform tests.eq('the counter counts each person once', ((public.next_public_call())->>'registered')::int, 3);
  perform tests.eq('anyone can read the counter for an open call', (select registered from public.call_stats where call_id = '22222222-2222-2222-2222-222222222222'), 3);
  perform tests.eq('the counter for a closed call is hidden', (select count(*) from public.call_stats where call_id = '33333333-3333-3333-3333-333333333333'), 0::bigint);
  perform tests.logout();
end $$;
select tests.eq('the member who invited them is recorded', (select referrer_id::text from public.registrations where email = 'pat1@example.com'), '00000000-0000-0000-0000-0000000000a1');
select tests.eq('an unknown inviter is ignored', (select referrer_id from public.registrations where email = 'pat2@example.com') is null, true);
select tests.eq('a lead cannot be an inviter', (select referrer_id from public.registrations where email = 'pat3@example.com') is null, true);
select tests.eq('registering twice keeps the first inviter', (select count(*) from public.registrations where email = 'pat1@example.com'), 1::bigint);
select tests.eq('first and last names are stored', (select first_name || '|' || last_name from public.registrations where email = 'pat1@example.com'), 'Pat|One');
-- the counter follows deletions and updates every viewer
insert into public.registrations (call_id, name, email) values ('33333333-3333-3333-3333-333333333333', 'Closed Person', 'closed@example.com');
select tests.eq('closed calls are still counted privately', (select registered from public.call_stats where call_id = '33333333-3333-3333-3333-333333333333'), 1);
delete from public.registrations where email = 'pat3@example.com';
select tests.eq('removing a registration lowers the counter', (select registered from public.call_stats where call_id = '22222222-2222-2222-2222-222222222222'), 2);
select tests.eq('the counter is part of the live-updates feed', (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'call_stats'), 1::bigint);

rollback;
