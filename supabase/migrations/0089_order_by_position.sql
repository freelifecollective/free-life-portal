-- Phase 119: accounts under a bubble are in one row, in the order you place them (the left/right flag no longer decides the order).
-- Where a dropped account goes ("first" or "right after") now counts every account under that bubble.
create or replace function public.move_tree_node(p_id uuid, p_parent uuid, p_side text, p_after uuid default null, p_first boolean default false) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); lo timestamptz; hi timestamptz; ts timestamptz := now(); ch uuid;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_side not in ('left', 'right') then raise exception 'bad side' using errcode = '22023'; end if;
  select chart_id into ch from public.family_tree_nodes where id = p_id and owner_id = me;
  if ch is null then raise exception 'not your bubble' using errcode = '42501'; end if;
  if p_parent is not null then
    if not exists (select 1 from public.family_tree_nodes where id = p_parent and owner_id = me and chart_id = ch) then raise exception 'that bubble is not in this chart' using errcode = '23514'; end if;
    if exists (
      with recursive below as (
        select id from public.family_tree_nodes where id = p_id and owner_id = me
        union all
        select n.id from public.family_tree_nodes n join below b on n.parent_id = b.id where n.owner_id = me
      ) select 1 from below where id = p_parent
    ) then raise exception 'a bubble cannot go under itself' using errcode = '23514'; end if;
  end if;
  if p_first then
    select min(created_at) into hi from public.family_tree_nodes where chart_id = ch and parent_id is not distinct from p_parent and id <> p_id;
    if hi is not null then ts := hi - interval '1 second'; end if;
  elsif p_after is not null then
    select created_at into lo from public.family_tree_nodes where id = p_after and chart_id = ch and parent_id is not distinct from p_parent and id <> p_id;
    if lo is not null then
      select min(created_at) into hi from public.family_tree_nodes where chart_id = ch and parent_id is not distinct from p_parent and id <> p_id and created_at > lo;
      ts := case when hi is null then greatest(now(), lo + interval '1 millisecond') else lo + (hi - lo) / 2 end;
    end if;
  end if;
  perform set_config('flc.moving', 'on', true);
  update public.family_tree_nodes set parent_id = p_parent, side = p_side, created_at = ts where id = p_id and owner_id = me;
  perform set_config('flc.moving', 'off', true);
end $$;
notify pgrst, 'reload schema';
