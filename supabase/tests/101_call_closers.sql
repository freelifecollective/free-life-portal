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
-- Call closers for hire
do $$ declare app uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('nobody is a closer yet', (select count(*) from public.call_closers_directory()), 0::bigint);
  insert into public.closer_applications (member_id, experience, availability, pitch, agreed) values ('00000000-0000-0000-0000-0000000000a1', 'some', 'Weekday evenings', 'I love helping people decide.', true);
  perform tests.fails('only one open application at a time', $q$ insert into public.closer_applications (member_id, experience, availability, pitch, agreed) values ('00000000-0000-0000-0000-0000000000a1', 'some', 'x', 'y', true) $q$, '23505');
  perform tests.fails('the agreement must be ticked', $q$ insert into public.closer_applications (member_id, experience, availability, pitch, agreed) values ('00000000-0000-0000-0000-0000000000a1', 'some', 'x', 'y', false) $q$, '23514');
  perform tests.fails('cannot apply as someone else', $q$ insert into public.closer_applications (member_id, experience, availability, pitch, agreed) values ('00000000-0000-0000-0000-0000000000a5', 'none', 'x', 'y', true) $q$, '42501');
  perform tests.eq('a member sees only their own application', (select count(*) from public.closer_applications), 1::bigint);
  select id into app from public.closer_applications limit 1;
  perform tests.fails('a member cannot approve', format('select public.review_closer_application(%L, true)', app), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('other members cannot read it', (select count(*) from public.closer_applications), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('the admin was told', (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a4' and title = 'New call closer application'), 1::bigint);
  perform tests.eq('the admin sees it', (select count(*) from public.closer_applications), 1::bigint);
  perform public.review_closer_application(app, true, null);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the new closer is in the list', (select count(*) from public.call_closers_directory()), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the applicant was told', (select count(*) from public.notifications where title = 'Your call closer application was approved!'), 1::bigint);
  perform tests.fails('a closer cannot apply again', $q$ insert into public.closer_applications (member_id, experience, availability, pitch, agreed) values ('00000000-0000-0000-0000-0000000000a1', 'some', 'x', 'y', true) $q$, '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads cannot browse closers', (select count(*) from public.call_closers_directory()), 0::bigint);
  perform tests.logout();
end $$;

do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  insert into public.booked_calls (member_id, lead_name, starts_at, closer_id, note) values ('00000000-0000-0000-0000-0000000000a5', 'Zed', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1', 'be kind');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the closer is told when hired for a call', (select count(*) from public.notifications where title like '% hired you for a call'), 1::bigint);
  perform tests.eq('the closer sees the booking', (select count(*) from public.booked_calls where lead_name = 'Zed'), 1::bigint);
  perform tests.logout();
end $$;
rollback;
