-- Phase 97: editing a direct message.
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

do $$ declare m uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.direct_messages (sender_id, recipient_id, body) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5', 'helo') returning id into m;
  perform tests.eq('the sender can edit', public.edit_direct_message(m, 'hello'), true);
  perform tests.eq('text changed', (select body from public.direct_messages where id = m), 'hello');
  perform tests.eq('edited time set', (select edited_at is not null from public.direct_messages where id = m), true);
  perform tests.fails('empty is refused', format('select public.edit_direct_message(%L, %L)', m, ' '), '22023');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the receiver cannot edit', public.edit_direct_message(m, 'hijack'), false);
  perform tests.eq('and sees the edited text', (select body from public.direct_messages where id = m), 'hello');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('a stranger cannot edit', public.edit_direct_message(m, 'hijack'), false);
  perform tests.logout();
end $$;
rollback;
