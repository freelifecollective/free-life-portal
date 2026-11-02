-- Undo and redo in Your Organization: put a chart's bubbles back exactly as they were in an earlier snapshot.
create or replace function public.restore_chart_nodes(p_chart uuid, p_nodes jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); n jsonb; i integer := 0; base timestamptz := clock_timestamp() - interval '1 hour';
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if not exists (select 1 from public.family_charts where id = p_chart and owner_id = me) then raise exception 'not your chart' using errcode = '42501'; end if;
  if jsonb_typeof(p_nodes) <> 'array' or jsonb_array_length(p_nodes) > 600 then raise exception 'a chart can hold up to 600 bubbles' using errcode = '23514'; end if;
  delete from public.family_tree_nodes where chart_id = p_chart and owner_id = me;
  -- every bubble first (in their old order), then who sits under whom
  for n in select value from jsonb_array_elements(p_nodes) loop
    insert into public.family_tree_nodes (id, owner_id, chart_id, parent_id, side, label, rank, linked_member_id, owned, created_at)
      values ((n ->> 'id')::uuid, me, p_chart, null, coalesce(n ->> 'side', 'left'), n ->> 'label', nullif(n ->> 'rank', ''),
              (select p.id from public.profiles p where p.id = nullif(n ->> 'linked_member_id', '')::uuid),
              coalesce((n ->> 'owned')::boolean, false), base + (i * interval '1 millisecond'));
    i := i + 1;
  end loop;
  perform set_config('flc.moving', 'on', true);
  for n in select value from jsonb_array_elements(p_nodes) where nullif(value ->> 'parent_id', '') is not null loop
    update public.family_tree_nodes set parent_id = (n ->> 'parent_id')::uuid where id = (n ->> 'id')::uuid and owner_id = me;
  end loop;
  perform set_config('flc.moving', 'off', true);
end $$;
revoke all on function public.restore_chart_nodes(uuid, jsonb) from public, anon;
grant execute on function public.restore_chart_nodes(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
