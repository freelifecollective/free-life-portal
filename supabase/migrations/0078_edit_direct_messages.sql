-- Phase 97: edit a direct message you sent.
alter table public.direct_messages add column if not exists edited_at timestamptz;

create or replace function public.edit_direct_message(p_id uuid, p_body text) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'bad message' using errcode = '22023'; end if;
  update public.direct_messages set body = btrim(p_body), edited_at = now()
   where id = p_id and sender_id = auth.uid() and image_url is null;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.edit_direct_message(uuid, text) from public, anon;
grant execute on function public.edit_direct_message(uuid, text) to authenticated;
notify pgrst, 'reload schema';
