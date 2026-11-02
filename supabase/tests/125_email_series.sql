-- Phase 137: email series.
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

do $$ declare c1 uuid; c2 uuid;
begin
  insert into public.calls (title, starts_at, audience) values ('Series call 1', now() + interval '2 days', 'leads_open') returning id into c1;
  insert into public.calls (title, starts_at, audience) values ('Series call 2', now() + interval '3 days', 'leads_open') returning id into c2;
  insert into public.registrations (call_id, name, email, first_name) values (c1, 'Test Lead', 'series.lead@example.com', 'Test');
  perform tests.eq('four emails are queued', (select count(*) from public.email_outbox where to_email = 'series.lead@example.com' and series = 'lead_welcome'), 4::bigint);
  perform tests.eq('the last one is ten days out', (select count(*) from public.email_outbox where to_email = 'series.lead@example.com' and step = 3 and send_after > now() + interval '9 days'), 1::bigint);
  insert into public.registrations (call_id, name, email, first_name) values (c2, 'Test Lead', 'series.lead@example.com', 'Test');
  perform tests.eq('registering for another call does not repeat the series', (select count(*) from public.email_outbox where to_email = 'series.lead@example.com' and series = 'lead_welcome'), 4::bigint);
  insert into public.email_unsubscribes (email) values ('stop.me@example.com');
  insert into public.registrations (call_id, name, email, first_name) values (c1, 'Stop Me', 'stop.me@example.com', 'Stop');
  perform tests.eq('someone who unsubscribed gets nothing', (select count(*) from public.email_outbox where to_email = 'stop.me@example.com' and series = 'lead_welcome'), 0::bigint);
end $$;
rollback;
