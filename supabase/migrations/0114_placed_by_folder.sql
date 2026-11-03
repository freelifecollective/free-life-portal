-- Documents shown on a page keep their folder names: files inside sub-folders are grouped under the sub-folder's name.
drop function if exists public.placed_documents(text);
create function public.placed_documents(p_placement text)
returns table (id uuid, name text, mime text, thumb_path text, doc_type text, folder_name text, sub_path text)
language sql stable set search_path = public, pg_temp
as $$
  with recursive tree as (
    select f.id, f.name, ''::text as sub, 1 as depth from public.doc_folders f where f.placement = p_placement
    union all
    select c.id, c.name, case when t.sub = '' then c.name else t.sub || ' / ' || c.name end, t.depth + 1
      from public.doc_folders c join tree t on c.parent_id = t.id where t.depth < 12
  )
  select d.id, d.name, d.mime, d.thumb_path, d.doc_type, t.name, t.sub
    from public.doc_files d join tree t on d.folder_id = t.id
   order by t.sub, d.name
   limit 500
$$;
grant execute on function public.placed_documents(text) to authenticated;

-- the old Documents "Pictures/Videos" folder (and everything inside it) now shows on the Pictures/Videos tab
update public.doc_folders set placement = 'media'
 where placement is null and name ilike '%picture%' and name ilike '%video%';
