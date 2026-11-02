-- Phase 164: removing and blocking people.
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

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4';
begin
  perform tests.login(mia);
  perform tests.fails('a member cannot remove people', format('select public.admin_remove_person(%L, ''manual'', ''x'', false)', max), '42501');
  perform tests.logout();
  perform tests.login(ada);
  perform tests.fails('you cannot remove yourself', format('select public.admin_remove_person(%L, ''manual'', ''x'', false)', ada), '42501');
  perform tests.fails('a manual removal needs a reason', format('select public.admin_remove_person(%L, ''manual'', '' '', false)', max), '22023');
  perform public.admin_remove_person(max, 'manual', 'Spamming the chats', false);
  perform tests.eq('removed and noted', (select removal_reason || ':' || removal_note from public.profiles where id = max), 'manual:Spamming the chats');
  perform tests.eq('they need a new invite to return', (select count(*) from public.signup_allowlist where email = 'max@example.com'), 0::bigint);
  perform tests.eq('they show in past people', (select count(*) from public.admin_past_people() where id = max and reason = 'manual'), 1::bigint);
  perform public.admin_remove_person(mia, 'cancelled', null, false);
  perform tests.eq('cancelled needs no note', (select removal_reason from public.profiles where id = mia), 'cancelled');
  perform tests.eq('inviting again restores them', public.admin_restore_person('mia@example.com', 'member'), true);
  perform tests.eq('and clears the removal', (select removed_at is null and removal_reason is null from public.profiles where id = mia), true);
  perform public.admin_remove_person(lena, null, 'Fake account', true);
  perform tests.eq('blocked', (select removal_reason from public.profiles where id = lena), 'blocked');
  perform tests.eq('email is on the block list', (select count(*) from public.blocked_emails where email = 'lena@example.com'), 1::bigint);
  perform tests.eq('a blocked person cannot be restored', public.admin_restore_person('lena@example.com', 'lead'), false);
  insert into public.signup_allowlist (email, role) values ('lena@example.com', 'lead');
  perform tests.eq('a blocked email cannot be invited again', (select count(*) from public.signup_allowlist where email = 'lena@example.com'), 0::bigint);
  perform tests.logout();
  perform tests.fails('and cannot create an account', 'insert into auth.users (id, email) values (gen_random_uuid(), ''LENA@example.com'')', 'P0001');
  perform tests.login(ada);
  perform tests.fails('admins cannot be removed', format('select public.admin_remove_person(%L, ''manual'', ''x'', false)', ada), '42501');
end $$;
rollback;
