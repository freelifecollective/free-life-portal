-- Documents move into the pages where they make most sense: a folder can be set to show on a page, below its subtitle.
alter table public.doc_folders add column placement text check (placement is null or char_length(placement) between 1 and 40);
create index doc_folders_placement_idx on public.doc_folders (placement) where placement is not null;

-- Everything in the folders (and their sub-folders) set to show on one page. Plain SQL as the caller, so people only get what they may already see.
create or replace function public.placed_documents(p_placement text)
returns table (id uuid, name text, mime text, thumb_path text, doc_type text, folder_name text)
language sql stable set search_path = public, pg_temp
as $$
  with recursive tree as (
    select f.id, f.name, 1 as depth from public.doc_folders f where f.placement = p_placement
    union all
    select c.id, t.name, t.depth + 1 from public.doc_folders c join tree t on c.parent_id = t.id where t.depth < 12
  )
  select d.id, d.name, d.mime, d.thumb_path, d.doc_type, t.name
    from public.doc_files d join tree t on d.folder_id = t.id
   order by d.name
   limit 300
$$;
grant execute on function public.placed_documents(text) to authenticated;

-- the Talking to Leads folder is the first to move: it goes below the subtitle on Verbiage + Objections
update public.doc_folders set placement = 'verbiage' where placement is null and lower(btrim(name)) in ('talking to leads', 'talking to your leads');
