-- Phase 176: resources and the Evidence Manual.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; ada uuid := '00000000-0000-0000-0000-0000000000a4';
begin
  perform tests.login(mia);
  perform tests.fails('a member cannot add a story', 'insert into public.evidence_stories (name, rank, story) values (''X'', ''6A'', ''y'')', '42501');
  perform tests.fails('a member cannot add a resource', 'insert into public.resource_items (category, title, url) values (''books'', ''X'', ''https://a.b'')', '42501');
  perform tests.logout();
  perform tests.login(ada);
  insert into public.evidence_stories (name, rank, story_type, story) values ('Sam', '6A2-8', 'single_mom', 'A story');
  perform tests.fails('only known ranks', 'insert into public.evidence_stories (name, rank, story) values (''Bo'', ''7Z'', ''y'')', '23514');
  insert into public.resource_items (category, title, url) values ('canva', 'Template', 'https://canva.com/x');
  perform tests.fails('links must be https', 'insert into public.resource_items (category, title, url) values (''books'', ''B'', ''http://a.b'')', '23514');
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('a member sees the stories', (select count(*) from public.evidence_stories), 1::bigint);
  perform tests.eq('a member sees the resources', (select count(*) from public.resource_items), 1::bigint);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('a lead sees no stories', (select count(*) from public.evidence_stories), 0::bigint);
  perform tests.eq('a lead sees no resources', (select count(*) from public.resource_items), 0::bigint);
end $$;
do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; ada uuid := '00000000-0000-0000-0000-0000000000a4'; f uuid; g uuid;
begin
  perform tests.login(ada);
  insert into public.doc_folders (name, placement) values ('Talking to Leads', 'verbiage') returning id into f;
  insert into public.doc_folders (name, parent_id) values ('Scripts', f) returning id into g;
  insert into public.doc_files (folder_id, name, storage_path) values (f, 'one.pdf', 'x/one.pdf'), (g, 'two.pdf', 'x/two.pdf');
  insert into public.doc_files (folder_id, name, storage_path) values (null, 'loose.pdf', 'x/loose.pdf');
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('a page shows its folder and sub-folder documents', (select count(*) from public.placed_documents('verbiage')), 2::bigint);
  perform tests.eq('another page shows none', (select count(*) from public.placed_documents('financing')), 0::bigint);
  perform tests.logout();
end $$;
rollback;
