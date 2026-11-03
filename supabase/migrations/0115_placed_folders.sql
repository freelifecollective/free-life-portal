-- A page shows the folders inside the folder chosen for it as separate folders (open one to see what is in it),
-- plus any files sitting directly in the chosen folder. Nothing is flattened.
create or replace function public.placed_folders(p_placement text)
returns table (id uuid, name text)
language sql stable set search_path = public, pg_temp
as $$
  select c.id, c.name
    from public.doc_folders c join public.doc_folders r on c.parent_id = r.id
   where r.placement = p_placement
   order by c.name
   limit 300
$$;
grant execute on function public.placed_folders(text) to authenticated;

drop function if exists public.placed_documents(text);
create function public.placed_documents(p_placement text)
returns table (id uuid, name text, mime text, thumb_path text, doc_type text, folder_name text, sub_path text)
language sql stable set search_path = public, pg_temp
as $$
  select d.id, d.name, d.mime, d.thumb_path, d.doc_type, f.name, ''::text
    from public.doc_files d join public.doc_folders f on d.folder_id = f.id
   where f.placement = p_placement
   order by d.name
   limit 500
$$;
grant execute on function public.placed_documents(text) to authenticated;
