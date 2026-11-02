-- A coach who is not in FLC: the member types their name instead of choosing someone from the portal.
alter table public.profiles add column outside_coach_name text check (outside_coach_name is null or char_length(btrim(outside_coach_name)) between 1 and 80);

drop function if exists public.set_my_coach(uuid);
create function public.set_my_coach(p_coach uuid, p_outside text default null) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare o text := nullif(btrim(coalesce(p_outside, '')), '');
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if o is not null and char_length(o) > 80 then raise exception 'name too long' using errcode = '22023'; end if;
  if o is not null then
    update public.profiles set coach_id = null, outside_coach_name = o where id = auth.uid();
    return;
  end if;
  if p_coach is not null and (p_coach = auth.uid() or not public.is_active_affiliate(p_coach)) then raise exception 'choose an affiliate' using errcode = '22023'; end if;
  update public.profiles set coach_id = p_coach, outside_coach_name = null where id = auth.uid();
end $$;
revoke all on function public.set_my_coach(uuid, text) from public, anon;
grant execute on function public.set_my_coach(uuid, text) to authenticated;

-- someone whose coach is outside FLC has no coach to message in the portal
create or replace function public.my_support_people() returns table (role text, id uuid, first_name text, last_name text, username text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select 'coach', c.id, c.first_name, c.last_name, c.username::text
    from public.profiles c
   where not exists (select 1 from public.profiles me where me.id = auth.uid() and me.outside_coach_name is not null)
     and c.id = coalesce((select coach_id from public.profiles where id = auth.uid()),
                         (select n.owner_id from public.family_tree_nodes n where n.linked_member_id = auth.uid() and n.owner_id <> auth.uid() order by n.created_at limit 1))
     and c.id <> auth.uid() and c.removed_at is null
  union all
  select 'buddy', b.id, b.first_name, b.last_name, b.username::text
    from (select case when m.chooser_id = auth.uid() then m.chosen_id else m.chooser_id end as other from public.ab_matches m
           where auth.uid() in (m.chooser_id, m.chosen_id) order by m.created_at limit 1) x
    join public.profiles b on b.id = x.other
$$;
notify pgrst, 'reload schema';
