-- Phase 92: edit your own message in a private group (chat posts already had an edited time).
alter table public.group_messages add column if not exists edited_at timestamptz;

create or replace function public.edit_group_message(p_id uuid, p_body text) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'bad message' using errcode = '22023'; end if;
  update public.group_messages set body = btrim(p_body), edited_at = now()
   where id = p_id and author_id = auth.uid() and image_url is null and public.is_group_member(group_id);
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.edit_group_message(uuid, text) from public, anon;
grant execute on function public.edit_group_message(uuid, text) to authenticated;
notify pgrst, 'reload schema';

-- Call lengths for lead booking: 20 to 60 minutes in steps of 5.
alter table public.coach_settings drop constraint if exists coach_settings_call_minutes_check;
update public.coach_settings set call_minutes = 20 where call_minutes < 20;
alter table public.coach_settings add constraint coach_settings_call_minutes_check check (call_minutes between 20 and 60 and call_minutes % 5 = 0);
notify pgrst, 'reload schema';
