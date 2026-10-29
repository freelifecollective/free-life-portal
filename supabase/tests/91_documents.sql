-- Phase 5k rules: documents.
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

do $$ declare top uuid; sub uuid; hidden uuid; deep uuid; f1 uuid; f2 uuid; f3 uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  insert into public.doc_folders (name, for_leads) values ('Welcome pack', true) returning id into top;
  insert into public.doc_folders (name, parent_id, for_leads) values ('Guides', top, true) returning id into sub;
  insert into public.doc_folders (name, parent_id, for_leads) values ('Team only', top, false) returning id into hidden;
  insert into public.doc_folders (name, parent_id, for_leads) values ('Inside team only', hidden, true) returning id into deep;
  insert into public.doc_files (folder_id, name, storage_path, mime, for_leads) values (sub, 'Start here.pdf', 'a/1.pdf', 'application/pdf', true) returning id into f1;
  insert into public.doc_files (folder_id, name, storage_path, mime, for_leads) values (sub, 'Private.pdf', 'a/2.pdf', 'application/pdf', false) returning id into f2;
  insert into public.doc_files (folder_id, name, storage_path, mime, for_leads) values (deep, 'Hidden by parent.pdf', 'a/3.pdf', 'application/pdf', true) returning id into f3;
  perform tests.fails('a folder cannot go inside itself', format('update public.doc_folders set parent_id = %L where id = %L', sub, top), '23514');
  perform tests.fails('a folder name cannot repeat in the same place', format('insert into public.doc_folders (name, parent_id) values (%L, %L)', ' guides ', top), '23505');
  perform tests.fails('only viewable files can be view-only', format('insert into public.doc_files (name, storage_path, mime, downloadable) values (%L, %L, %L, false)', 'x.docx', 'a/x.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), '23514');
  insert into public.doc_files (folder_id, name, storage_path, mime, downloadable, for_leads) values (sub, 'View only.pdf', 'a/4.pdf', 'application/pdf', false, true);
  perform tests.eq('an admin sees everything', (select count(*) from public.doc_files), 4::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('a paying member sees every folder', (select count(*) from public.doc_folders), 4::bigint);
  perform tests.eq('and every document', (select count(*) from public.doc_files), 4::bigint);
  perform tests.eq('and can read the stored files', public.can_read_doc_object('a/2.pdf'), true);
  perform tests.eq('but cannot change anything', tests.rows('delete from public.doc_files'), 0::bigint);
  perform tests.logout();

  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead sees only the folders switched on all the way down', (select count(*) from public.doc_folders), 2::bigint);
  perform tests.eq('and only documents switched on for leads', (select count(*) from public.doc_files), 2::bigint);
  perform tests.eq('a switched-on file inside a hidden folder stays hidden', (select count(*) from public.doc_files where name = 'Hidden by parent.pdf'), 0::bigint);
  perform tests.eq('the stored file is blocked too', public.can_read_doc_object('a/3.pdf'), false);
  perform tests.eq('while the visible one can be read', public.can_read_doc_object('a/1.pdf'), true);
  perform tests.eq('a lead can see which documents are view-only', (select downloadable from public.doc_files where name = 'View only.pdf'), false);
  perform tests.fails('a lead cannot create folders', 'insert into public.doc_folders (name) values ($q$x$q$)', '42501');
  perform tests.logout();

  perform tests.login(null, 'anon');
  perform tests.eq('visitors see nothing', (select count(*) from public.doc_folders), 0::bigint);
  perform tests.logout();

  -- switch a whole folder on for leads, including everything inside it
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform public.set_doc_visibility(top, true, false, true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('now leads see all four folders', (select count(*) from public.doc_folders), 4::bigint);
  perform tests.eq('and all four documents', (select count(*) from public.doc_files), 4::bigint);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a4');
  perform public.set_doc_visibility(top, false, false, true);
  perform tests.eq('switching a folder off hides everything inside it from leads', (select count(*) from public.doc_files where for_leads), 0::bigint);
  perform tests.eq('and the folder changes are in the activity log', (select count(*) >= 4 from public.audit_log where table_name = 'doc_folders' and action = 'update'), true);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.fails('members cannot change visibility', format('select public.set_doc_visibility(%L, true, true, true)', top), '42501');
  perform tests.logout();
end $$;
rollback;
