-- Phase 96: leads can be added to private groups and chat in them, but still cannot create groups.
create or replace function public.group_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = p_user and p.role in ('lead', 'member', 'admin') and p.onboarded_at is not null and p.removed_at is null) $$;

drop policy if exists gmsg_insert on public.group_messages;
create policy gmsg_insert on public.group_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(group_id)
              and (group_messages.reply_to is null or exists (select 1 from public.group_messages r where r.id = group_messages.reply_to and r.group_id = group_messages.group_id)));
-- if the owner leaves, the longest-standing affiliate takes over (a lead never becomes owner); with no affiliate left the group is deleted
create or replace function public.remove_group_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); was_owner boolean; next uuid;
begin
  if not public.is_group_member(p_group) then raise exception 'not in this group' using errcode = '42501'; end if;
  if p_user <> me and not public.is_group_owner(p_group) then raise exception 'only the group owner can remove people' using errcode = '42501'; end if;
  select (role = 'owner') into was_owner from public.group_members where group_id = p_group and user_id = p_user;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  if was_owner then
    select gm.user_id into next from public.group_members gm join public.profiles p on p.id = gm.user_id where gm.group_id = p_group and p.role <> 'lead' order by gm.joined_at limit 1;
    if next is null then delete from public.group_chats where id = p_group; else update public.group_members set role = 'owner' where group_id = p_group and user_id = next; end if;
  end if;
end $$;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
