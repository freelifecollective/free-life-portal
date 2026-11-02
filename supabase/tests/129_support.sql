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
  perform tests.logout();
end $$;

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; max uuid := '00000000-0000-0000-0000-0000000000a5'; r1 uuid; r2 uuid; r3 uuid; c1 uuid; c2 uuid;
begin
  update public.profiles set coach_id = max where id = mia;
  insert into public.recordings (title, description, vimeo_id, topics, published, recorded_at, thumb_url) values
    ('Old mindset call', 'staying strong', '700000001', array['Belief + Mindset'], true, now() - interval '30 days', 'https://example.com/a.jpg') returning id into r1;
  insert into public.recordings (title, description, vimeo_id, topics, published, recorded_at) values ('New mindset call', 'belief', '700000002', array['Belief + Mindset'], true, now() - interval '2 days') returning id into r2;
  insert into public.recordings (title, vimeo_id, topics, published, recorded_at) values ('Ads call', '700000003', array['Ads'], true, now() - interval '1 day') returning id into r3;
  insert into public.calls (title, starts_at) values ('Feedback call', now() - interval '40 days') returning id into c1;
  update public.recordings set call_id = c1 where id = r1;
  insert into public.call_feedback (call_id, user_id, thoughts, favourite, takeaway) values (c1, max, 'x', 'x', 'x');
  perform tests.login(mia);
  perform tests.eq('wanting to quit is understood', (select count(*) from public.support_intent('I want to quit my business') where theme = 'Wanting to quit' and checkin), 1::bigint);
  perform tests.eq('and so is a mindset question', (select count(*) from public.support_intent('I''m struggling with my mindset right now') where checkin), 1::bigint);
  perform tests.eq('a leads question does not ask the check in', (select count(*) from public.support_intent('my leads ghost me') where checkin), 0::bigint);
  perform tests.eq('quitting finds the mindset calls, not business sheets', (select count(*) from public.support_search('I want to quit my business') where kind = 'recording' and title like '%mindset%'), 2::bigint);
  perform tests.eq('the call with a review comes first', (select title from public.support_search('I want to quit my business') where kind = 'recording' limit 1), 'Old mindset call');
  perform tests.eq('the review count is shown', (select reviews from public.support_search('I want to quit my business') where title = 'Old mindset call'), 1);
  perform tests.eq('the picture comes with it', (select thumb from public.support_search('I want to quit my business') where title = 'Old mindset call'), 'https://example.com/a.jpg');
  perform tests.eq('the ads call is not offered for quitting', (select count(*) from public.support_search('I want to quit my business') where title = 'Ads call'), 0::bigint);
  perform tests.eq('filler words alone find nothing', (select count(*) from public.support_search('right now')), 0::bigint);
  perform tests.eq('the coach is found', (select count(*) from public.my_support_people() where role = 'coach'), 1::bigint);
  -- what people ask is kept anonymously: themes and words only, and admins only see needs that keep coming up
  perform public.log_support_ask('I want to quit my business', 0);
  perform public.log_support_ask('I want to quit and give up on this', 0);
  perform public.log_support_ask('so ready to quit right now', 1);
  perform public.log_support_ask('how do I run ads', 2);
  perform tests.eq('a member cannot read the asks', (select count(*) from public.support_suggestions()), 0::bigint);
  perform tests.fails('and has no direct access to the table', 'select * from public.support_asks', '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform tests.eq('the admin sees the recurring theme', (select asked from public.support_suggestions() where label = 'Wanting to quit' and kind = 'theme'), 3);
  perform tests.eq('and how often nothing was found', (select nothing_found from public.support_suggestions() where label = 'Wanting to quit' and kind = 'theme'), 2);
  perform tests.eq('a one-off question is not shown', (select count(*) from public.support_suggestions() where label in ('ads', 'Ads')), 0::bigint);
  perform tests.eq('the stored ask holds no names or question text', (select count(*) from information_schema.columns where table_name = 'support_asks' and column_name in ('user_id', 'question', 'member_id')), 0::bigint);
  perform tests.logout();
end $$;
rollback;
