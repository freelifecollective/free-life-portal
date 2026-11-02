-- Phase 139: Laceys downline.
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

do $$ declare dl uuid := '00000000-0000-0000-0000-0000000000d1'; mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; f_ok uuid; f_no uuid; c_dl uuid; c_lead uuid; c_aff uuid; main uuid;
begin
  insert into public.signup_allowlist (email, role) values ('dee@example.com', 'downline');
  insert into auth.users (id, email) values (dl, 'dee@example.com');
  update public.profiles set first_name = 'Dee', last_name = 'D', username = 'deedown', onboarded_at = now() where id = dl;
  perform tests.eq('the account is a downline account', (select role::text from public.profiles where id = dl), 'downline');
  perform tests.eq('a downline account passes no lead check', (select public.role_allows('downline'::public.app_role, 'lead')), false);
  perform tests.eq('leads cannot see downline things', (select public.role_allows('lead'::public.app_role, 'downline')), false);
  perform tests.eq('affiliates can see downline things', (select public.role_allows('member'::public.app_role, 'downline')), true);

  -- documents
  insert into public.doc_folders (name, for_downline) values ('For the downline', true) returning id into f_ok;
  insert into public.doc_folders (name, for_leads) values ('Leads only', true) returning id into f_no;
  perform tests.login(dl);
  perform tests.eq('downline sees their folder', (select count(*) from public.doc_folders where id = f_ok), 1::bigint);
  perform tests.eq('downline does not see a leads folder', (select count(*) from public.doc_folders where id = f_no), 0::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead does not see the downline folder', (select count(*) from public.doc_folders where id = f_ok), 0::bigint);
  perform tests.logout();

  -- calls
  insert into public.calls (title, starts_at, audience, downline_open) values ('Downline call', now() + interval '2 days', 'affiliates_only', true) returning id into c_dl;
  insert into public.calls (title, starts_at, audience) values ('Lead call', now() + interval '2 days', 'leads_open') returning id into c_lead;
  insert into public.calls (title, starts_at, audience) values ('FLC call', now() + interval '2 days', 'affiliates_only') returning id into c_aff;
  perform tests.login(dl);
  perform tests.eq('downline sees only the downline call', (select count(*) from public.calls where id in (c_dl, c_lead, c_aff)), 1::bigint);
  perform tests.eq('and it is theirs', (select count(*) from public.calls where id = c_dl), 1::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead sees only the lead call', (select count(*) from public.calls where id in (c_dl, c_lead, c_aff)), 1::bigint);
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('an affiliate sees all three', (select count(*) from public.calls where id in (c_dl, c_lead, c_aff)), 3::bigint);
  perform tests.logout();

  -- Main Discussion
  select id into main from public.chats where slug = 'main-discussion';
  perform tests.eq('Main Discussion exists', main is not null, true);
  perform tests.login(dl);
  perform tests.eq('downline sees exactly one chat', (select count(*) from public.chats), 1::bigint);
  perform tests.eq('downline sees no posts in an affiliates chat', (select count(*) from public.chat_posts where chat_id <> main), 0::bigint);
  insert into public.chat_posts (chat_id, author_id, body) values (main, dl, 'Hello from the downline');
  perform tests.eq('downline can post there', (select count(*) from public.chat_posts where chat_id = main), 1::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead does not see Main Discussion in the list', (select count(*) from public.chats where id = main), 0::bigint);
  perform tests.eq('a lead cannot read Main Discussion', (select count(*) from public.chat_posts where chat_id = main), 0::bigint);
  perform tests.fails('a lead cannot post in Main Discussion', format('insert into public.chat_posts (chat_id, author_id, body) values (%L, %L, ''hi'')', main, lena), '42501');
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('an affiliate sees Main Discussion and the post', (select count(*) from public.chat_posts where chat_id = main), 1::bigint);
  perform tests.logout();

  -- water map
  perform tests.login(dl);
  insert into public.water_share (member_id, lat, lng, place, prefilter, water_type) values (dl, 40, -90, 'St Louis', true, 'city');
  perform tests.eq('downline can add themselves to the map', (select count(*) from public.water_share_map() where member_id = dl), 1::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead still cannot see the map', (select count(*) from public.water_share_map()), 0::bigint);
  perform tests.logout();

  -- messages
  perform tests.login(dl);
  perform tests.eq('downline can message an affiliate', public.can_message(mia), true);
  perform tests.eq('downline cannot message a lead', public.can_message(lena), false);
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('an affiliate can message the downline', public.can_message(dl), true);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead cannot message the downline', public.can_message(dl), false);
  perform tests.logout();

  -- the public sign-up page
  perform tests.login(null, 'anon');
  perform tests.eq('a stranger can ask for an account', public.downline_signup('New.Person@Example.com'), 'ok');
  perform tests.eq('asking again is fine', public.downline_signup('new.person@example.com'), 'ok');
  perform tests.eq('a paying member is told they are already in', public.downline_signup('mia@example.com'), 'member');
  perform tests.eq('a bad email is refused', public.downline_signup('nope'), 'bad');
  perform tests.logout();
  perform tests.eq('the new person is allowed in as downline', (select role::text from public.signup_allowlist where email = 'new.person@example.com'), 'downline');
  perform tests.login(ada);
  perform tests.eq('the admin still sees every call', (select count(*) from public.calls where id in (c_dl, c_lead, c_aff)), 3::bigint);
  perform tests.eq('the admin still sees all documents', (select count(*) from public.doc_folders where id in (f_ok, f_no)), 2::bigint);
  perform tests.logout();
end $$;
rollback;
