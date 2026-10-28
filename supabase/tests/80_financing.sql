-- Phase 5e rules: financing options.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
insert into public.financing_options (title, description, status) values ('Business credit card', 'Open a 0% card', 'approved');

do $$ declare fid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees approved options', (select count(*) from public.financing_options), 1::bigint);
  perform tests.fails('a lead cannot suggest one', format('insert into public.financing_options (title, description, submitted_by) values (%L, %L, auth.uid())', 'X', 'Y'), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.financing_options (title, description, link, submitted_by) values ('Personal loan', 'Borrow from a credit union', 'https://example.com', auth.uid()) returning id into fid;
  perform tests.eq('a member sees approved plus their own pending', (select count(*) from public.financing_options), 2::bigint);
  perform tests.fails('the same option cannot be listed twice', format('insert into public.financing_options (title, description, submitted_by) values (%L, %L, auth.uid())', ' business CREDIT card ', 'again'), '23505');
  perform tests.fails('a member cannot approve their own', format('insert into public.financing_options (title, description, submitted_by, status) values (%L, %L, auth.uid(), %L)', 'Self approved', 'x', 'approved'), '42501');
  perform tests.fails('links must be https', format('insert into public.financing_options (title, description, link, submitted_by) values (%L, %L, %L, auth.uid())', 'Bad link', 'x', 'http://nope.com'), '23514');
  perform tests.eq('a member cannot edit options', tests.rows(format('update public.financing_options set status = %L where id = %L', 'approved', fid)), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('leads do not see pending ones', (select count(*) from public.financing_options), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an admin sees everything', (select count(*) from public.financing_options), 2::bigint);
  perform tests.eq('an admin can approve', tests.rows(format('update public.financing_options set status = %L, reviewed_at = now() where id = %L', 'approved', fid)), 1::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('once approved, leads see it', (select count(*) from public.financing_options), 2::bigint);
  perform tests.logout();
end $$;
rollback;
