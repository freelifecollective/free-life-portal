-- When each person in a list was last around (for the FLC Members and New Members lists). Affiliates only.
create function public.presence_of_many(p_ids uuid[]) returns table (member_id uuid, last_seen_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.member_id, m.last_seen_at from public.member_presence m
  where m.member_id = any (p_ids[1:2000]) and public.can_see('member')
$$;
revoke all on function public.presence_of_many(uuid[]) from public, anon;
grant execute on function public.presence_of_many(uuid[]) to authenticated;
notify pgrst, 'reload schema';
