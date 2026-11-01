-- Copy the top bubble of one chart into another chart: just the bubble, or the bubble with everything under it.
create or replace function public.copy_chart_top(p_src uuid, p_dest uuid, p_side text, p_below boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); c public.family_charts; nid uuid; nm text;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_side not in ('left', 'right') then raise exception 'bad side' using errcode = '22023'; end if;
  select * into c from public.family_charts where id = p_src and owner_id = me;
  if c.id is null then raise exception 'not your chart' using errcode = '42501'; end if;
  if not exists (select 1 from public.family_charts where id = p_dest and owner_id = me) then raise exception 'not your chart' using errcode = '42501'; end if;
  select coalesce(c.root_label, nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'Me') into nm from public.profiles p where p.id = me;
  insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label, rank, owned, created_at)
    values (me, p_dest, null, p_side, left(coalesce(nm, 'Me'), 60), c.root_rank, true, now())
    returning id into nid;
  if coalesce(p_below, true) then
    perform public.copy_nodes_into(me, p_src, null, p_dest, nid, null, true);
  end if;
  return nid;
end $$;
revoke all on function public.copy_chart_top(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.copy_chart_top(uuid, uuid, text, boolean) to authenticated;
notify pgrst, 'reload schema';
