-- Phase 135: birthdays.
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

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; w uuid; yr int := extract(year from current_date); n int;
begin
  update public.profiles set birth_month = extract(month from current_date), birth_day = extract(day from current_date) where id = mia;
  perform tests.login(max);
  perform tests.eq('banner shows Mia', (select count(*) from public.birthdays_today(current_date) where id = mia), 1::bigint);
  perform tests.eq('a far-off date shows nobody', (select count(*) from public.birthdays_today(current_date + 5)), 0::bigint);
  w := public.post_birthday_wish(mia, yr, '  Happy birthday!  ');
  perform tests.eq('a wish is saved trimmed', (select body from public.birthday_wishes_list(mia, yr) where id = w), 'Happy birthday!');
  perform tests.fails('no empty wish', format('select public.post_birthday_wish(%L, %s, %L)', mia, yr, '   '), '22023');
  perform tests.fails('no wish for last year', format('select public.post_birthday_wish(%L, %s, %L)', mia, yr - 1, 'hi'), '42501');
  perform tests.fails('no direct table access', 'select * from public.birthday_wishes', '42501');
  perform tests.eq('the party page knows the person', (select first_name from public.birthday_person(mia, yr)), 'Mia');
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead cannot open the party page', (select count(*) from public.birthday_person(mia, yr)), 0::bigint);
  perform tests.eq('a lead sees no banner', (select count(*) from public.birthdays_today(current_date)), 0::bigint);
  perform tests.eq('a lead reads no wishes', (select count(*) from public.birthday_wishes_list(mia, yr)), 0::bigint);
  perform tests.fails('a lead cannot post', format('select public.post_birthday_wish(%L, %s, %L)', mia, yr, 'hi'), '42501');
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('Mia reads her own card', (select count(*) from public.birthday_wishes_list(mia, yr)), 1::bigint);
  perform tests.eq('Mia has a card for this year', (select wishes from public.my_birthday_cards() where year = yr), 1::bigint);
  perform public.delete_birthday_wish(w);
  perform tests.eq('the birthday person cannot delete others wishes', (select count(*) from public.birthday_wishes_list(mia, yr)), 1::bigint);
  perform tests.logout();
  perform tests.login(ada);
  perform public.delete_birthday_wish(w);
  perform tests.eq('an admin can remove a wish', (select count(*) from public.my_birthday_cards()), 0::bigint);
  perform tests.logout();
  update public.profiles set birth_month = null, birth_day = null where id = mia;
  perform tests.login(max);
  perform tests.fails('after the day nobody can post', format('select public.post_birthday_wish(%L, %s, %L)', mia, yr, 'late'), '42501');
end $$;
rollback;
