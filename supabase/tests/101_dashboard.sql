-- Dashboard rules: landing tracking, member stats, lead list.
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('max@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
insert into public.calls (id, title, kind, audience, starts_at, duration_minutes, host)
  values ('00000000-0000-0000-0000-00000000c001', 'Community call', 'community', 'leads_open', now() + interval '1 day', 60, 'Sonya');

do $$ declare s jsonb; n int; begin
  -- anonymous visitors tap the page
  perform tests.login(null, 'anon');
  perform public.track_landing('miamember', 'visit', 'visitor-aaaaaaaa');
  perform public.track_landing('miamember', 'visit', 'visitor-aaaaaaaa');
  perform public.track_landing('miamember', 'visit', 'visitor-bbbbbbbb');
  perform public.track_landing('miamember', 'click', 'visitor-aaaaaaaa');
  perform public.track_landing('nobody', 'visit', 'visitor-cccccccc');
  perform public.track_landing('miamember', 'bogus', 'visitor-aaaaaaaa');
  perform public.track_landing('miamember', 'visit', 'x');
  perform tests.logout();

  -- two people fill in Mia's form, one creates an account
  insert into public.registrations (call_id, name, first_name, last_name, email, referrer_id)
    values ('00000000-0000-0000-0000-00000000c001', 'Lena L', 'Lena', 'L', 'lena@example.com', '00000000-0000-0000-0000-0000000000a1'),
           ('00000000-0000-0000-0000-00000000c001', 'Pat P', 'Pat', 'P', 'pat@example.com', '00000000-0000-0000-0000-0000000000a1');
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a3','lena@example.com');
  insert into public.call_attendance (call_id, user_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3');

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  s := public.member_stats(now() - interval '1 day', now() + interval '1 day', '00000000-0000-0000-0000-00000000c001');
  perform tests.eq('two different visitors, repeats not counted', (s->>'visitors')::int, 2);
  perform tests.eq('one click', (s->>'clicks')::int, 1);
  perform tests.eq('two form fill-outs', (s->>'forms')::int, 2);
  perform tests.eq('one became a portal member', (s->>'registered')::int, 1);
  perform tests.eq('two registered for the call', (s->>'call_registered')::int, 2);
  s := public.member_stats(now() - interval '10 days', now() - interval '5 days');
  perform tests.eq('an earlier date range is empty', (s->>'forms')::int, 0);
  perform tests.eq('lead list has both people', (select count(*) from public.my_leads(now() - interval '1 day', now() + interval '1 day'))::int, 2);
  perform tests.eq('attendance shows on the lead', (select (calls->0->>'attended')::boolean from public.my_leads(now() - interval '1 day', now() + interval '1 day') where email = 'lena@example.com'), true);
  perform tests.eq('no attendance for the other', (select (calls->0->>'attended')::boolean from public.my_leads(now() - interval '1 day', now() + interval '1 day') where email = 'pat@example.com'), false);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('another affiliate sees none of those leads', (select count(*) from public.my_leads(now() - interval '1 day', now() + interval '1 day'))::int, 0);
  perform tests.eq('and cannot ask for someone elses', (select count(*) from public.my_leads(now() - interval '1 day', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1'))::int, 0);
  perform tests.eq('their own stats are empty', (public.member_stats(now() - interval '1 day', now() + interval '1 day')->>'visitors')::int, 0);
  perform tests.logout();
end $$;
rollback;
