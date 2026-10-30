-- Replay watching: progress is remembered, and finishing enough of it earns badges.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
insert into public.recordings (id, title, vimeo_id, published, for_leads) values
  ('00000000-0000-0000-0000-00000000d001', 'Replay one', '123456789', true, false),
  ('00000000-0000-0000-0000-00000000d002', 'Draft', '123456780', false, false);

do $$ declare s jsonb;
begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform public.record_view('00000000-0000-0000-0000-00000000d001', 10);
  perform tests.eq('a started replay is remembered', (select max_pct from public.recording_views), 10);
  perform tests.eq('but not counted as watched yet', (select completed_at is null from public.recording_views), true);
  perform public.record_view('00000000-0000-0000-0000-00000000d001', 5);
  perform tests.eq('progress never goes backwards', (select max_pct from public.recording_views), 10);
  perform public.record_view('00000000-0000-0000-0000-00000000d001', 85);
  perform tests.eq('85% counts as watched', (select completed_at is not null from public.recording_views), true);
  perform public.record_view('00000000-0000-0000-0000-00000000d002', 100);
  perform tests.eq('an unpublished recording is ignored', (select count(*) from public.recording_views), 1::bigint);
  s := public.badge_state();
  perform tests.eq('first replay badge', (s->'new') ? 'replays_1', true);
  perform tests.eq('five replays not yet', (s->'new') ? 'replays_5', false);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform public.record_view('00000000-0000-0000-0000-00000000d001', 100);
  perform tests.eq('a lead cannot log a members-only replay', (select count(*) from public.recording_views), 0::bigint);
  perform tests.logout();
end $$;
rollback;
