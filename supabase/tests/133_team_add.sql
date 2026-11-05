-- Phase 205: adding team members and inviting them.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; l uuid; card uuid; tm uuid; need boolean; r text;
begin
  perform tests.login(mia);
  perform public.ensure_lead_boards();
  select x.id into l from public.lead_lists x where x.name = 'New Lead';
  perform tests.logout();
  insert into public.lead_cards (list_id, user_id, name, email) values (l, mia, 'Newbie Nora', 'nora@example.com') returning id into card;
  perform tests.login(mia);
  select t.id, t.needs_invite into tm, need from public.team_add_member('Newbie Nora', 'Nora@Example.com', '1A', card) t;
  perform tests.eq('someone with no account needs an invite', need, true);
  perform tests.eq('the card left the lead boards', (select affiliated_at is not null from public.lead_cards where id = card), true);
  perform tests.eq('starts at 1A', (select rank from public.team_members where id = tm), '1A');
  perform tests.eq('and is waiting to be invited', (select status from public.my_team_overview() where id = tm), 'not_in_portal');
  perform tests.eq('invite goes out', public.invite_team_member(tm), 'invited');
  perform tests.eq('and the list says invited', (select status from public.my_team_overview() where id = tm), 'invited');
  perform tests.logout();
  perform tests.eq('the invite lets them in as the unpaid kind', (select role::text from public.signup_allowlist where email = 'nora@example.com'), 'downline');
  -- they create their account
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'nora@example.com');
  perform tests.login(mia);
  perform tests.eq('they appear as a registered team member by themselves', (select status from public.my_team_overview() where id = tm), 'registered');
  -- someone who already has an account is linked at once
  select t.needs_invite into need from public.team_add_member('Max', 'max@example.com', '3A', null) t;
  perform tests.eq('no invite for someone already in the portal', need, false);
  perform tests.eq('and they are active', (select status from public.my_team_overview() where email = 'max@example.com'), 'active');
  perform tests.fails('a name is needed', 'select * from public.team_add_member('' '', ''a@b.co'', ''1A'', null)', '22023');
  perform tests.logout();
end $$;
rollback;
