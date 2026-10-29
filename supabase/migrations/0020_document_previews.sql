-- Preview pictures for documents (made in the admin's browser when files are added).
alter table public.doc_files add column thumb_path text;

create or replace function public.can_read_doc_object(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.doc_files f where (f.storage_path = p_name or f.thumb_path = p_name) and public.doc_file_visible(f.id)) $$;
