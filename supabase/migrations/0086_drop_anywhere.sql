-- Phase 114: drop a bubble onto a spot beside a line and it becomes a new branch exactly there: you choose the account it hangs under,
-- the side, and where it sits among the others.
drop function if exists public.move_tree_node(uuid, uuid, text);
create or replace function public.move_tree_node(p_id uuid, p_parent uuid, p_side text, p_after uuid default null, p_first boolean default false) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); lo timestamptz; hi timestamptz; ts timestamptz := now();
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_side not in ('left', 'right') then raise exception 'bad side' using errcode = '22023'; end if;
  if not exists (select 1 from public.family_tree_nodes where id = p_id and owner_id = me) then raise exception 'not your bubble' using errcode = '42501'; end if;
  if p_parent is not null then
    if not exists (select 1 from public.family_tree_nodes where id = p_parent and owner_id = me) then raise exception 'that bubble is not in your tree' using errcode = '23514'; end if;
    /* a bubble cannot go under itself or under anything below it */
    if exists (
      with recursive below as (
        select id from public.family_tree_nodes where id = p_id and owner_id = me
        union all
        select n.id from public.family_tree_nodes n join below b on n.parent_id = b.id where n.owner_id = me
      ) select 1 from below where id = p_parent
    ) then raise exception 'a bubble cannot go under itself' using errcode = '23514'; end if;
  end if;
  /* where it sits among the others on that side: first, right after one of them, or (the default) at the end */
  if p_first then
    select min(created_at) into hi from public.family_tree_nodes where owner_id = me and parent_id is not distinct from p_parent and side = p_side and id <> p_id;
    if hi is not null then ts := hi - interval '1 second'; end if;
  elsif p_after is not null then
    select created_at into lo from public.family_tree_nodes where id = p_after and owner_id = me and parent_id is not distinct from p_parent and side = p_side and id <> p_id;
    if lo is not null then
      select min(created_at) into hi from public.family_tree_nodes where owner_id = me and parent_id is not distinct from p_parent and side = p_side and id <> p_id and created_at > lo;
      ts := case when hi is null then greatest(now(), lo + interval '1 millisecond') else lo + (hi - lo) / 2 end;
    end if;
  end if;
  perform set_config('flc.moving', 'on', true);
  update public.family_tree_nodes set parent_id = p_parent, side = p_side, created_at = ts where id = p_id and owner_id = me;
  perform set_config('flc.moving', 'off', true);
end $$;
revoke all on function public.move_tree_node(uuid, uuid, text, uuid, boolean) from public, anon;
grant execute on function public.move_tree_node(uuid, uuid, text, uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
