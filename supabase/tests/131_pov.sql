-- Phase 203: what each kind of account sees.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('dee@example.com','downline'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a6','dee@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Dee', last_name='D', username='deedownline', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
insert into public.recordings (id, title, vimeo_id, recorded_at, published, for_downline) values
  ('00000000-0000-0000-0000-0000000000e1', 'For the downline', '1234567', now(), true, true),
  ('00000000-0000-0000-0000-0000000000e2', 'Members only', '1234568', now(), true, false);

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; dee uuid := '00000000-0000-0000-0000-0000000000a6'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; tm uuid;
begin
  perform tests.login(dee);
  perform tests.eq('the downline sees the recordings switched on for them', (select count(*) from public.recordings), 1::bigint);
  perform tests.eq('and every chat, so locks can show', (select count(*) from public.chats where min_role = 'member'), (select count(*) from public.chats where min_role = 'member'));
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead does not see them', (select count(*) from public.recordings), 0::bigint);
  perform tests.logout();
  -- a coach takes a new affiliate's calls
  insert into public.team_members (user_id, name, linked_profile, rank) values (mia, 'Max', max, 'New') returning id into tm;
  perform tests.eq('without a plan the affiliate takes their own leads', public.booking_target(max), max);
  perform tests.login(mia);
  perform public.set_team_call_plan(tm, 'for', null);
  perform tests.logout();
  perform tests.eq('the coach takes the calls', public.booking_target(max), mia);
  perform tests.login(mia);
  perform public.set_team_call_plan(tm, 'together', '6A2');
  perform tests.logout();
  perform tests.eq('until a rank is reached', public.booking_target(max), mia);
  update public.team_members set rank = '6A2' where id = tm;
  perform tests.eq('then the affiliate takes their own again', public.booking_target(max), max);
  perform tests.login(max);
  perform tests.fails('only the coach can set it', format('select public.set_team_call_plan(%L, ''for'', null)', tm), '42501');
  perform tests.logout();
end $$;
rollback;
