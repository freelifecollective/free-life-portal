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

-- Country: private to the person and admins; admins can count members per country; others cannot.
update public.profiles set country = 'ES' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set country = 'ES' where id = '00000000-0000-0000-0000-0000000000a5';
update public.profiles set country = 'BR' where id = '00000000-0000-0000-0000-0000000000a4';
update public.profiles set country = 'ES' where id = '00000000-0000-0000-0000-0000000000a3';
do $$ begin
  perform tests.fails('a bad country code is refused', $q$ update public.profiles set country = 'Spain' where id = '00000000-0000-0000-0000-0000000000a1' $q$, '23514');
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a member can read their own country', (select country from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'ES');
  perform tests.eq('a member cannot read someone elses country', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a5'), 0::bigint);
  perform tests.eq('a member sees no country counts', (select count(*) from public.admin_country_counts()), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('admin: members in Spain', (select members from public.admin_country_counts() where country = 'ES'), 2);
  perform tests.eq('admin: leads in Spain', (select leads from public.admin_country_counts() where country = 'ES'), 1);
  perform tests.eq('admin: members in Brazil', (select members from public.admin_country_counts() where country = 'BR'), 1);
  perform tests.logout();
end $$;
rollback;
