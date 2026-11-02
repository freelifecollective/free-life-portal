-- Phase 148: Get Support.
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

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; c uuid; f uuid; n int;
begin
  insert into public.support_resources (kind, title, description, url, keywords) values
    ('book', 'Think and Grow Rich', 'A classic on mindset and persistence', null, 'motivation stuck discouraged'),
    ('website', 'Lead follow-up guide', 'How to follow up with leads who go quiet', 'https://example.com/follow-up', 'no response ghosted'),
    ('website', 'Leads only reading', 'Basics for new people', 'https://example.com/leads', 'welcome');
  update public.support_resources set for_leads = true where title = 'Leads only reading';
  insert into public.calls (title, description, starts_at, audience) values ('Mindset reset call', 'Get unstuck and stay motivated', now() + interval '2 days', 'leads_open');
  insert into public.calls (title, starts_at, audience) values ('Old call about mindset', now() - interval '3 days', 'leads_open');
  insert into public.doc_folders (name) values ('Scripts') returning id into f;
  insert into public.doc_files (folder_id, name, storage_path) values (f, 'Follow-up-script.pdf', 'x/follow-up.pdf');
  perform tests.login(mia);
  perform tests.eq('a feeling finds the book through its extra words', (select count(*) from public.support_search('I feel so discouraged and stuck') where kind = 'resource' and title = 'Think and Grow Rich'), 1::bigint);
  perform tests.eq('any one word can match', (select count(*) from public.support_search('my leads never respond to my follow up') where title = 'Lead follow-up guide'), 1::bigint);
  perform tests.eq('the document is found by its name', (select count(*) from public.support_search('follow up script') where kind = 'document'), 1::bigint);
  perform tests.eq('an upcoming call is suggested', (select count(*) from public.support_search('mindset') where kind = 'call' and title = 'Mindset reset call'), 1::bigint);
  perform tests.eq('a finished call is not', (select count(*) from public.support_search('mindset') where title = 'Old call about mindset'), 0::bigint);
  perform tests.eq('nonsense finds nothing', (select count(*) from public.support_search('zzzxqy')), 0::bigint);
  perform tests.eq('an empty question finds nothing', (select count(*) from public.support_search('   ')), 0::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead sees only what is open to leads', (select count(*) from public.support_search('leads follow up basics welcome') where kind = 'resource'), 1::bigint);
  perform tests.eq('and not the affiliates-only documents', (select count(*) from public.support_search('follow up script') where kind = 'document'), 0::bigint);
  insert into public.support_questions (user_id, question, found) values (lena, 'I cannot get started', 0);
  perform tests.fails('no asking as someone else', format('insert into public.support_questions (user_id, question) values (%L, %L)', mia, 'hi'), '42501');
  perform tests.eq('a lead cannot read the questions', (select count(*) from public.support_questions), 0::bigint);
  perform tests.logout();
  perform tests.login(ada);
  perform tests.eq('the admin reads the questions', (select count(*) from public.support_questions), 1::bigint);
  perform tests.logout();
end $$;
rollback;
