-- Phase 136: people and invites.
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

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; r text;
begin
  perform tests.login(mia);
  perform tests.eq('an affiliate can invite a lead', public.invite_lead('New.Lead@Example.com', 'met at the gym'), 'invited');
  perform tests.eq('inviting again says exists', public.invite_lead('new.lead@example.com'), 'exists');
  perform tests.eq('an existing member email says exists', public.invite_lead('max@example.com'), 'exists');
  perform tests.fails('a bad email', 'select public.invite_lead(''nope'')', '22023');
  perform tests.eq('my invites lists it', (select count(*) from public.my_invites() where email = 'new.lead@example.com' and claimed_at is null), 1::bigint);
  perform tests.logout();
  perform tests.login(max);
  perform tests.eq('another affiliate does not see Mia''s invites', (select count(*) from public.my_invites()), 0::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.fails('a lead cannot invite', 'select public.invite_lead(''x@example.com'')', '42501');
  perform tests.logout();
  -- the lead account Lena was invited by Mia
  update public.profiles set email = 'lena@example.com' where id = lena;
  update public.signup_allowlist set created_by = mia where email = 'lena@example.com';
  perform tests.login(max);
  perform tests.eq('Max is warned about Mia''s lead', public.message_lead_warning(lena), true);
  perform tests.eq('Max sees who the lead belongs to', (select first_name from public.lead_owner_info(lena)), 'Mia');
  perform tests.eq('no warning for a member', public.message_lead_warning(mia), false);
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('no warning for your own lead', public.message_lead_warning(lena), false);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead gets no owner info', (select count(*) from public.lead_owner_info(lena)), 0::bigint);
  perform tests.logout();
  perform tests.login(ada);
  perform tests.eq('admin sees Mia''s people', (select count(*) from public.admin_affiliate_people(mia)), 2::bigint);
  perform tests.logout();
  perform tests.eq('admin sees leads and their owner', (select count(*) from public.admin_leads_with_owner() where owner_first is not null or owner_first is null), (select count(*) from public.profiles where role = 'lead' and onboarded_at is not null and removed_at is null));
  perform tests.logout();
  perform tests.login(max);
  perform tests.eq('a member cannot read the leads list', (select count(*) from public.admin_leads_with_owner()), 0::bigint);
  perform tests.eq('a member cannot read an affiliate''s people list', (select count(*) from public.admin_affiliate_people(mia)), 0::bigint);
end $$;

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; c uuid;
begin
  perform tests.logout();
  insert into public.signup_allowlist (email, role, created_by) values ('invited.one@example.com', 'lead', mia);
  insert into public.calls (title, starts_at, audience) values ('Leads list call', now() + interval '2 days', 'leads_open') returning id into c;
  insert into public.registrations (call_id, name, email, first_name, referrer_id) values (c, 'Form Person', 'form.person@example.com', 'Form', max);
  insert into public.registrations (call_id, name, email, first_name, referrer_id) values (c, 'Invited One', 'invited.one@example.com', 'Invited', max);
  perform tests.login(ada);
  perform tests.eq('the invited person is listed once, as invited by Mia', (select count(*) from public.admin_all_leads() where email = 'invited.one@example.com' and source = 'invited' and owner_id = mia), 1::bigint);
  perform tests.eq('the person who filled in a form is listed with their affiliate', (select count(*) from public.admin_all_leads() where email = 'form.person@example.com' and source = 'form' and owner_id = max), 1::bigint);
  perform tests.eq('nobody is listed twice', (select count(*) from public.admin_all_leads() where email = 'invited.one@example.com'), 1::bigint);
  perform tests.logout();
  perform tests.login(max);
  perform tests.eq('a member cannot read it', (select count(*) from public.admin_all_leads()), 0::bigint);
  perform tests.logout();
end $$;
rollback;
