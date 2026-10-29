-- Start over: clears every questionnaire answer (and the shared rank), as if the member had never filled it in.
create function public.ab_reset() returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'members only' using errcode = '42501'; end if;
  update public.ab_profiles set answers = '{}'::jsonb, complete = false, updated_at = now() where member_id = auth.uid();
  update public.member_private set rank_id = null, updated_at = now() where member_id = auth.uid();
end $$;
revoke all on function public.ab_reset() from public, anon;
grant execute on function public.ab_reset() to authenticated;
