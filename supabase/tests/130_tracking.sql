-- Phase 202: tracking.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
insert into public.classroom_courses (id, title, published) values ('00000000-0000-0000-0000-00000000c001', 'Business Launch Course', true);
insert into public.classroom_lessons (id, course_id, title, published, sort) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000c001', 'One', true, 1),
  ('00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-00000000c001', 'Two', true, 2);

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; card uuid; l uuid; tm uuid; b uuid;
begin
  perform tests.login(lena);
  perform tests.fails('a lead cannot open lead tracking', 'select public.ensure_lead_boards()', '42501');
  perform tests.logout();
  perform tests.login(mia);
  perform public.ensure_lead_boards();
  perform public.ensure_lead_boards();
  perform tests.eq('two starter boards, made once', (select count(*) from public.lead_boards), 2::bigint);
  perform tests.eq('seven lists on New Leads', (select count(*) from public.lead_lists x join public.lead_boards bb on bb.id = x.board_id where bb.name = 'New Leads'), 7::bigint);
  perform tests.eq('seven lists on the portal board', (select count(*) from public.lead_lists x join public.lead_boards bb on bb.id = x.board_id where bb.kind = 'portal'), 7::bigint);
  select x.id into l from public.lead_lists x where x.name = 'New Lead';
  insert into public.lead_cards (list_id, user_id, name, email) values (l, mia, 'Max Lead', 'max@example.com') returning id into card;
  select public.lead_register_in_portal(card) into b;
  perform tests.eq('registered moves it to the portal board', (select bb.kind from public.lead_cards c join public.lead_lists x on x.id = c.list_id join public.lead_boards bb on bb.id = x.board_id where c.id = card), 'portal');
  perform tests.eq('into Registered for the Portal', (select x.name from public.lead_cards c join public.lead_lists x on x.id = c.list_id where c.id = card), 'Registered for the Portal');
  delete from public.lead_boards where kind = 'portal';
  perform tests.eq('deleting a board is allowed', (select count(*) from public.lead_boards), 1::bigint);
  insert into public.lead_cards (list_id, user_id, name, email) values (l, mia, 'Again', 'x@y.co') returning id into card;
  perform public.lead_register_in_portal(card);
  perform tests.eq('the portal board comes back when needed', (select count(*) from public.lead_boards where kind = 'portal'), 1::bigint);
  perform tests.fails('only your own cards', format('select public.lead_register_in_portal(%L)', gen_random_uuid()), '42501');
  insert into public.lead_cards (list_id, user_id, name, email) values (l, mia, 'Max Team', 'max@example.com') returning id into card;
  tm := public.lead_affiliated(card, '6A');
  perform tests.eq('affiliated makes a team member', (select count(*) from public.team_members where id = tm and rank = '6A'), 1::bigint);
  perform tests.eq('linked to their portal account', (select linked_profile from public.team_members where id = tm), max);
  perform tests.eq('with the starter check-in list', (select count(*) from public.team_checks where member_id = tm), 13::bigint);
  perform tests.eq('and the card leaves the board', (select affiliated_at is not null from public.lead_cards where id = card), true);
  perform tests.eq('active in FLC', (select status from public.my_team_overview() where id = tm), 'active');
  perform tests.eq('the course is not started yet', (select started from public.my_team_overview() where id = tm), false);
  perform tests.eq('two lessons in the course', (select total_lessons from public.my_team_overview() where id = tm), 2);
  perform tests.logout();
  insert into public.classroom_progress (user_id, lesson_id) values (max, '00000000-0000-0000-0000-0000000001a1');
  perform tests.login(mia);
  perform tests.eq('their progress shows without reading their account', (select done_lessons from public.my_team_overview() where id = tm), 1);
  perform tests.logout();
  perform tests.login(max);
  perform tests.eq('nobody else sees my team', (select count(*) from public.my_team_overview()), 0::bigint);
  perform tests.eq('or my boards', (select count(*) from public.lead_boards), 0::bigint);
  perform tests.logout();
end $$;
rollback;
