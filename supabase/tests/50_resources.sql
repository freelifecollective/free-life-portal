-- Phase 5b rules: chat subtitles and resource submissions.
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

-- people
insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead'),('ada@example.com','member');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';

select tests.eq('welcome chat has a lead subtitle', (select description_lead from public.chats where slug='welcome-discussion'), 'Welcome to the family, feel free to introduce yourself and ask any questions you may have.');
select tests.eq('only Social Media has no subtitle yet', (select count(*) from public.chats where min_role='member' and description is null), 1::bigint);

do $$ declare sid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.resource_submissions (submitter_id, title, description, links) values (auth.uid(), 'Script', 'My script', array['https://example.com/a']) returning id into sid;
  perform tests.eq('a member can submit', (select count(*) from public.resource_submissions), 1::bigint);
  perform tests.fails('http links are refused', format('insert into public.resource_submissions (submitter_id, title, description, links) values (auth.uid(), %L, %L, array[%L])', 't', 'd', 'http://x.com'), '23514');
  perform tests.fails('cannot submit as someone else', format('insert into public.resource_submissions (submitter_id, title, description) values (%L, %L, %L)', '00000000-0000-0000-0000-0000000000a3', 't', 'd'), '42501');
  perform tests.fails('cannot pre-approve', format('insert into public.resource_submissions (submitter_id, title, description, status) values (auth.uid(), %L, %L, %L)', 't', 'd', 'accepted'), '42501');
  perform tests.eq('a member cannot review their own', tests.rows(format('update public.resource_submissions set status = %L where id = %L', 'accepted', sid)), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.fails('a lead cannot submit', format('insert into public.resource_submissions (submitter_id, title, description) values (auth.uid(), %L, %L)', 't', 'd'), '42501');
  perform tests.eq('a lead sees none', (select count(*) from public.resource_submissions), 0::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('an admin sees all', (select count(*) from public.resource_submissions), 1::bigint);
  perform tests.eq('an admin can accept', tests.rows(format('update public.resource_submissions set status = %L, reviewed_at = now(), reviewed_by = auth.uid() where id = %L', 'accepted', sid)), 1::bigint);
  perform tests.logout();
end $$;
rollback;
