-- Phase 5j rules: outsourcing directory, hires, reviews, membership status.
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

do $$ declare hid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.outsourcing_profiles (member_id, headline, tasks, hourly_rate_cents) values (auth.uid(), 'Graphic design', array['Ads Creation', 'Canva Presentations'], 3500);
  perform tests.fails('a rate under $1 is refused', format('insert into public.outsourcing_profiles (member_id, headline, tasks, hourly_rate_cents) values (%L, %L, %L, 5)', '00000000-0000-0000-0000-0000000000a5', 'x', '{Ads Creation}'), '42501');
  perform tests.fails('only offerings from the list are accepted', format('insert into public.outsourcing_profiles (member_id, tasks, hourly_rate_cents) values (%L, %L, 2000)', '00000000-0000-0000-0000-0000000000a1', '{Underwater basket weaving}'), '23514');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('leads cannot list themselves', format('insert into public.outsourcing_profiles (member_id, headline, tasks, hourly_rate_cents) values (auth.uid(), %L, %L, 2000)', 'x', '{Ads Creation}'), '42501');
  perform tests.eq('leads cannot see the directory', (select count(*) from public.outsourcing_directory()), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('an affiliate sees the directory', (select count(*) from public.outsourcing_directory()), 1::bigint);
  perform tests.eq('no hires yet', (select hires from public.outsourcing_directory()), 0);
  insert into public.outsourcing_hires (provider_id, hirer_id) values ('00000000-0000-0000-0000-0000000000a1', auth.uid()) returning id into hid;
  perform tests.fails('you cannot hire the same person twice', format('insert into public.outsourcing_hires (provider_id, hirer_id) values (%L, auth.uid())', '00000000-0000-0000-0000-0000000000a1'), '23505');
  perform tests.fails('you cannot hire as someone else', format('insert into public.outsourcing_hires (provider_id, hirer_id) values (%L, %L)', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4'), '42501');
  perform tests.eq('hiring is counted', (select hires from public.outsourcing_directory()), 1);
  update public.outsourcing_hires set rating = 5, review = 'Great logo work' where id = hid;
  perform tests.eq('a review is counted', (select reviews from public.outsourcing_directory()), 1);
  perform tests.eq('and averaged', (select avg_rating from public.outsourcing_directory()), 5.0);
  perform tests.fails('a rating over 5 is refused', format('update public.outsourcing_hires set rating = 9 where id = %L', hid), '23514');
  perform tests.fails('you cannot rewrite who was hired', format('update public.outsourcing_hires set hirer_id = %L where id = %L', '00000000-0000-0000-0000-0000000000a4', hid), '42501');
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the provider was told about the hire and the review', (select count(*) from public.notifications where kind = 'outsourcing'), 2::bigint);
  perform tests.eq('the provider cannot edit their own reviews', tests.rows(format('update public.outsourcing_hires set rating = 1 where id = %L', hid)), 0::bigint);
  perform tests.logout();

  -- two unpaid months, or removal, takes someone off the list
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  update public.profiles set unpaid_since = (current_date - interval '1 month')::date where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.eq('one unpaid month: still listed', (select count(*) from public.outsourcing_directory()), 1::bigint);
  update public.profiles set unpaid_since = (current_date - interval '2 months' - interval '1 day')::date where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.eq('two unpaid months: gone from the list', (select count(*) from public.outsourcing_directory()), 0::bigint);
  update public.profiles set unpaid_since = null where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.eq('paying again brings them back', (select count(*) from public.outsourcing_directory()), 1::bigint);
  update public.profiles set removed_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
  perform tests.eq('removed from the community: gone', (select count(*) from public.outsourcing_directory()), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('people cannot restore themselves', 'update public.profiles set removed_at = null where id = auth.uid()', '42501');
  perform tests.logout();
end $$;
rollback;
