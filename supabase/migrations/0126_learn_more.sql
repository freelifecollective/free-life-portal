-- Learn More (leads only): the documents from the Product Information folder, shown to leads on their own tab.
do $$
declare root record;
begin
  for root in select id from public.doc_folders where lower(btrim(name)) = 'product information' loop
    -- the folder, everything inside it, and the folders above it (a lead only sees a folder when every folder above it is open to leads too)
    with recursive down as (
      select id from public.doc_folders where id = root.id
      union all
      select c.id from public.doc_folders c join down d on c.parent_id = d.id
    ), up as (
      select id, parent_id from public.doc_folders where id = root.id
      union all
      select p.id, p.parent_id from public.doc_folders p join up u on p.id = u.parent_id
    )
    update public.doc_folders f set for_leads = true where f.id in (select id from down union select id from up);
    with recursive down as (
      select id from public.doc_folders where id = root.id
      union all
      select c.id from public.doc_folders c join down d on c.parent_id = d.id
    )
    update public.doc_files set for_leads = true where folder_id in (select id from down);
    update public.doc_folders set placement = 'learn' where id = root.id and placement is null;
  end loop;
end $$;
