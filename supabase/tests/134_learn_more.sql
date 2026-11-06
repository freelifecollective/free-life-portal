-- Phase 211: Learn More documents for leads.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
insert into public.doc_folders (id, name) values ('00000000-0000-0000-0000-00000000f001', 'Library');
insert into public.doc_folders (id, name, parent_id) values ('00000000-0000-0000-0000-00000000f002', 'Product Information', '00000000-0000-0000-0000-00000000f001');
insert into public.doc_folders (id, name, parent_id) values ('00000000-0000-0000-0000-00000000f003', 'Sheets', '00000000-0000-0000-0000-00000000f002'), ('00000000-0000-0000-0000-00000000f004', 'Private', '00000000-0000-0000-0000-00000000f001');
insert into public.doc_files (folder_id, name, storage_path) values ('00000000-0000-0000-0000-00000000f002', 'one.pdf', 'x/1'), ('00000000-0000-0000-0000-00000000f003', 'two.pdf', 'x/2'), ('00000000-0000-0000-0000-00000000f004', 'secret.pdf', 'x/3');
-- the same steps as the Learn More migration
do $$
declare root record;
begin
  for root in select id from public.doc_folders where lower(btrim(name)) = 'product information' loop
    with recursive down as (select id from public.doc_folders where id = root.id union all select c.id from public.doc_folders c join down d on c.parent_id = d.id),
    up as (select id, parent_id from public.doc_folders where id = root.id union all select p.id, p.parent_id from public.doc_folders p join up u on p.id = u.parent_id)
    update public.doc_folders f set for_leads = true where f.id in (select id from down union select id from up);
    with recursive down as (select id from public.doc_folders where id = root.id union all select c.id from public.doc_folders c join down d on c.parent_id = d.id)
    update public.doc_files set for_leads = true where folder_id in (select id from down);
    update public.doc_folders set placement = 'learn' where id = root.id and placement is null;
  end loop;
end $$;
do $$ declare lena uuid := '00000000-0000-0000-0000-0000000000a3';
begin
  perform tests.login(lena);
  perform tests.eq('a lead sees the product documents, including inside sub-folders', (select count(*) from public.placed_documents('learn')), 1::bigint);
  perform tests.eq('and the folders inside', (select count(*) from public.placed_folders('learn')), 1::bigint);
  perform tests.eq('but not documents elsewhere in the library', (select count(*) from public.doc_files where name = 'secret.pdf'), 0::bigint);
  perform tests.eq('the two product files are visible to a lead', (select count(*) from public.doc_files where name in ('one.pdf', 'two.pdf')), 2::bigint);
  perform tests.logout();
end $$;
rollback;
