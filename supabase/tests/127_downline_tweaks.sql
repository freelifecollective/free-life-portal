-- Phase 140: downline round two.
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

do $$ declare dl uuid := '00000000-0000-0000-0000-0000000000d1'; mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; c_both uuid; c_dl uuid; c_lead uuid; ch record;
begin
  insert into public.signup_allowlist (email, role) values ('dee@example.com', 'downline');
  insert into auth.users (id, email) values (dl, 'dee@example.com');
  update public.profiles set first_name = 'Dee', last_name = 'D', username = 'deedown', onboarded_at = now() where id = dl;
  insert into public.calls (title, starts_at, audience, downline_open) values ('Leads and downline', now() + interval '2 days', 'leads_open', true) returning id into c_both;
  insert into public.calls (title, starts_at, audience, downline_open) values ('Downline only', now() + interval '2 days', 'affiliates_only', true) returning id into c_dl;
  insert into public.calls (title, starts_at, audience, downline_open) values ('Leads only', now() + interval '2 days', 'leads_open', false) returning id into c_lead;
  perform tests.login(dl);
  perform tests.eq('downline sees the shared call and their own', (select count(*) from public.calls where id in (c_both, c_dl, c_lead)), 2::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead sees the shared call and the leads call', (select count(*) from public.calls where id in (c_both, c_dl, c_lead)), 2::bigint);
  perform tests.logout();
  perform tests.eq('everyone is told about the shared call', (select count(*) from public.call_audience_users(c_both)), (select count(*) from public.profiles where onboarded_at is not null));
  perform tests.eq('only the downline and affiliates hear of the downline call', (select count(*) from public.call_audience_users(c_dl) u join public.profiles p on p.id = u.user_id where p.role = 'lead'), 0::bigint);
  select * into ch from public.chats where slug = 'main-discussion';
  perform tests.eq('the chat is now called Lacey''s Downline', ch.name, 'Lacey''s Downline');
  perform tests.eq('and sits after Affiliates Only', (select s.sort from public.chat_sections s where s.id = ch.section_id), 3::smallint);
  perform tests.eq('affiliates and downline have different subtitles', ch.description <> ch.description_lead, true);
end $$;
rollback;
