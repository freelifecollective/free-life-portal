-- Funnels: only Builder and Leader build them; anyone can open a live one and fill in its form.
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


insert into public.signup_allowlist (email, role) values ('bo@example.com','member'),('sam@example.com','member'),('ada@example.com','member');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1','bo@example.com'),('00000000-0000-0000-0000-0000000000c2','sam@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com');
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Bo', last_name='B', username='bobuilder', onboarded_at=now(), plan=97 where id='00000000-0000-0000-0000-0000000000b1';
update public.profiles set first_name='Sam', last_name='S', username='samstarter', onboarded_at=now(), plan=47 where id='00000000-0000-0000-0000-0000000000c2';

do $$ declare bo uuid := '00000000-0000-0000-0000-0000000000b1'; sam uuid := '00000000-0000-0000-0000-0000000000c2'; ada uuid := '00000000-0000-0000-0000-0000000000a4';
  f uuid; s1 uuid; s2 uuid;
begin
  perform tests.login(sam);
  perform tests.fails('Starter cannot build a funnel', format('insert into public.funnels (owner_id, name, slug) values (%L, %L, %L)', sam, 'Mine', 'mine'), '42501');
  perform tests.logout();

  perform tests.login(bo);
  insert into public.funnels (owner_id, name, slug) values (bo, 'Free Guide', 'free-guide') returning id into f;
  insert into public.funnel_steps (funnel_id, position, name, slug, page) values (f, 0, 'Opt-in', 'optin', '{"version":1,"settings":{},"sections":[{"id":"a"}]}') returning id into s1;
  insert into public.funnel_steps (funnel_id, position, name, slug) values (f, 1, 'Thank you', 'thanks') returning id into s2;
  perform tests.fails('slugs are plain words', format('update public.funnels set slug = %L where id = %L', 'Bad Slug!', f), '23514');
  perform tests.fails('a page must have sections', format('update public.funnel_steps set page = %L where id = %L', '{"x":1}', s1), '23514');
  perform tests.logout();

  perform tests.login(sam);
  perform tests.eq('others cannot see someone''s funnels', (select count(*) from public.funnels where id = f), 0::bigint);
  update public.funnel_steps set name = 'Hacked' where id = s1;
  perform tests.logout();

  perform tests.eq('the first step opens without naming it', public.public_funnel_step('bobuilder', 'free-guide', null) ->> 'step_slug', 'optin');
  perform tests.eq('and knows the next step', public.public_funnel_step('bobuilder', 'free-guide', null) ->> 'next_slug', 'thanks');
  perform tests.eq('a named step opens', public.public_funnel_step('bobuilder', 'free-guide', 'thanks') ->> 'step_name', 'Thank you');
  perform tests.eq('the last step has no next', public.public_funnel_step('bobuilder', 'free-guide', 'thanks') ->> 'next_slug', null);
  perform tests.eq('anyone can fill in the form', public.submit_funnel_form(f, s1, '{"email":"lead@example.com","name":"Lee"}'), true);
  perform tests.eq('but not with odd fields', public.submit_funnel_form(f, s1, '{"email":{"x":1}}'), false);

  perform tests.login(bo);
  perform tests.eq('others could not change their pages', (select name from public.funnel_steps where id = s1), 'Opt-in');
  perform tests.eq('the owner sees who signed up', (select fields ->> 'email' from public.funnel_submissions where funnel_id = f), 'lead@example.com');
  perform tests.logout();

  perform tests.login(ada);
  update public.profiles set plan = 47 where id = bo;
  perform tests.logout();
  perform tests.eq('a funnel goes offline when its owner moves down to Starter', public.public_funnel_step('bobuilder', 'free-guide', null), null::jsonb);
  perform tests.eq('and its form stops taking sign-ups', public.submit_funnel_form(f, s1, '{"email":"x@example.com"}'), false);
  perform tests.login(bo);
  perform tests.eq('the owner still sees their funnel', (select count(*) from public.funnels where id = f), 1::bigint);
  update public.funnels set name = 'New' where id = f;
  perform tests.eq('but cannot change it', (select name from public.funnels where id = f), 'Free Guide');
  perform tests.logout();
end $$;
rollback;
