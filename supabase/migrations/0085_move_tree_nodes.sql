-- Phase 113: drag an account (with everything under it) to a different spot in Your Organization.
create or replace function public.family_tree_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null and not exists (select 1 from public.family_tree_nodes p where p.id = new.parent_id and p.owner_id = new.owner_id) then
      raise exception 'that bubble is not in your tree' using errcode = '23514';
    end if;
    if (select count(*) from public.family_tree_nodes where owner_id = new.owner_id) >= 600 then
      raise exception 'a tree can hold up to 600 bubbles' using errcode = '23514';
    end if;
  else
    if new.owner_id is distinct from old.owner_id then
      raise exception 'a bubble cannot change owner' using errcode = '23514';
    end if;
    /* moving is only allowed through move_tree_node below */
    if (new.parent_id is distinct from old.parent_id or new.side is distinct from old.side) and coalesce(current_setting('flc.moving', true), '') <> 'on' then
      raise exception 'a bubble cannot be moved' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function public.move_tree_node(p_id uuid, p_parent uuid, p_side text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
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
  perform set_config('flc.moving', 'on', true);
  update public.family_tree_nodes set parent_id = p_parent, side = p_side, created_at = now() where id = p_id and owner_id = me;   /* it joins the end of its new side */
  perform set_config('flc.moving', 'off', true);
end $$;
revoke all on function public.move_tree_node(uuid, uuid, text) from public, anon;
grant execute on function public.move_tree_node(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';
