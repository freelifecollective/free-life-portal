-- A booked call stays open until the coach or call closer ends it (sometimes calls run over). As a safety net a room still closes by itself 12 hours after the start.
alter table public.booked_calls add column if not exists ended_at timestamptz;

drop function if exists public.room_info(uuid);
create or replace function public.room_info(p_call uuid)
returns table (id uuid, starts_at timestamptz, minutes integer, my_role text, other_name text, other_avatar text, completed boolean, open_now boolean, ended boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select b.id, b.starts_at, coalesce(cs.call_minutes, 30)::int,
         case when auth.uid() = b.lead_id then 'lead' else 'host' end,
         nullif(btrim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, '')), ''), o.avatar_url,
         b.completed_at is not null,
         b.ended_at is null and now() between b.starts_at - interval '15 minutes' and b.starts_at + interval '12 hours',
         b.ended_at is not null
    from public.booked_calls b
    left join public.coach_settings cs on cs.member_id = coalesce(b.closer_id, b.member_id)
    left join public.profiles o on o.id = case when auth.uid() = b.lead_id then coalesce(b.closer_id, b.member_id) else b.lead_id end
   where b.id = p_call and auth.uid() is not null and auth.uid() in (b.lead_id, coalesce(b.closer_id, b.member_id))
$$;
revoke all on function public.room_info(uuid) from public, anon;
grant execute on function public.room_info(uuid) to authenticated;

-- only the person taking the call (the coach, or the call closer) can end it, for everyone
create or replace function public.end_room(p_call uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare b public.booked_calls;
begin
  select * into b from public.booked_calls where id = p_call for update;
  if b.id is null or auth.uid() is distinct from coalesce(b.closer_id, b.member_id) then raise exception 'only the host can end the call' using errcode = '42501'; end if;
  update public.booked_calls set ended_at = coalesce(ended_at, now()) where id = p_call;
end $$;
revoke all on function public.end_room(uuid) from public, anon;
grant execute on function public.end_room(uuid) to authenticated;

-- the other person checks this every few seconds to learn the call was ended
create or replace function public.room_ended(p_call uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select b.ended_at is not null from public.booked_calls b where b.id = p_call and auth.uid() in (b.lead_id, coalesce(b.closer_id, b.member_id))), false) $$;
revoke all on function public.room_ended(uuid) from public, anon;
grant execute on function public.room_ended(uuid) to authenticated;

-- the call keeps counting while it runs over: the window now matches the room's
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'room_beat';
  def := replace(def, 'now() not between b.starts_at - interval ''15 minutes'' and b.starts_at + make_interval(mins => mins) + interval ''90 minutes''', 'b.ended_at is not null or now() not between b.starts_at - interval ''15 minutes'' and b.starts_at + interval ''12 hours''');
  execute def;
end $$;
notify pgrst, 'reload schema';
