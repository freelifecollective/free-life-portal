-- Landing page choices: Builder words and video, and the coach-video switch for everyone else.
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;


insert into public.signup_allowlist (email, role) values ('cora@example.com','member'),('sam@example.com','member'),('ada@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1','cora@example.com'),('00000000-0000-0000-0000-0000000000c2','sam@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com');
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Cora', last_name='C', username='coracoach', onboarded_at=now(), plan=97 where id='00000000-0000-0000-0000-0000000000c1';
update public.profiles set first_name='Sam', last_name='S', username='samstarter', onboarded_at=now(), plan=47, coach_id='00000000-0000-0000-0000-0000000000c1' where id='00000000-0000-0000-0000-0000000000c2';

do $$ declare cora uuid := '00000000-0000-0000-0000-0000000000c1'; sam uuid := '00000000-0000-0000-0000-0000000000c2'; ada uuid := '00000000-0000-0000-0000-0000000000a4';
begin
  perform tests.login(sam);
  perform tests.eq('no coach video yet', public.my_coach_video(), null::jsonb);
  perform tests.fails('Starter cannot change the words', format('insert into public.landing_pages (member_id, copy) values (%L, %L)', sam, '{"title1":"Hi"}'), '42501');
  insert into public.landing_pages (member_id, video_choice) values (sam, 'coach');
  perform tests.fails('or put up a video', format('update public.landing_pages set video_url = %L where member_id = %L', 'https://player.vimeo.com/video/123456', sam), '42501');
  perform tests.logout();

  perform tests.login(cora);
  insert into public.landing_pages (member_id, copy, video_url) values (cora, '{"title1":"Hello","cta":"Tell me more"}', 'https://player.vimeo.com/video/123456');
  perform tests.fails('unknown words are refused', format('update public.landing_pages set copy = %L where member_id = %L', '{"script":"x"}', cora), '23514');
  perform tests.fails('only Vimeo or YouTube players', format('update public.landing_pages set video_url = %L where member_id = %L', 'https://evil.example.com/v', cora), '23514');
  perform tests.logout();

  perform tests.eq('Builder words show on their page', (public.public_landing('coracoach') -> 'copy' ->> 'title1'), 'Hello');
  perform tests.eq('and their own video', (public.public_landing('coracoach') ->> 'video_url'), 'https://player.vimeo.com/video/123456');
  perform tests.eq('the Starter who chose their coach gets the coach video', (public.public_landing('samstarter') ->> 'video_url'), 'https://player.vimeo.com/video/123456');

  perform tests.login(sam);
  perform tests.eq('and the switch knows whose it is', public.my_coach_video() ->> 'coach_first_name', 'Cora');
  update public.landing_pages set video_choice = 'standard' where member_id = sam;
  perform tests.logout();
  perform tests.eq('switching back gives the standard video', (public.public_landing('samstarter') ->> 'video_url'), null);

  perform tests.login(sam);
  update public.landing_pages set video_choice = 'coach' where member_id = sam;
  perform tests.logout();
  perform tests.login(ada);
  update public.profiles set plan = 47 where id = cora;
  perform tests.logout();
  perform tests.eq('a coach back on Starter: their words stop showing', (public.public_landing('coracoach') -> 'copy'), 'null'::jsonb);
  perform tests.eq('and their video is no longer offered', (public.public_landing('samstarter') ->> 'video_url'), null);
  perform tests.login(sam);
  perform tests.eq('so the switch hides', public.my_coach_video(), null::jsonb);
  perform tests.logout();
end $$;
rollback;
