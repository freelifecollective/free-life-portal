-- Hiring a call closer for the next one or two coaching calls, or for every future call.
-- Once leads can book calls, any call booked without a closer goes to the member's hired closer automatically.
create table if not exists public.closer_hires (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles (id) on delete cascade,
  closer_id   uuid not null references public.profiles (id) on delete cascade,
  calls_total smallint check (calls_total in (1, 2)),           -- empty means every future call
  calls_used  smallint not null default 0 check (calls_used >= 0),
  note        text check (note is null or char_length(note) <= 200),
  status      text not null default 'active' check (status in ('active', 'ended')),
  created_at  timestamptz not null default now(),
  ended_at    timestamptz,
  check (member_id <> closer_id)
);
create unique index if not exists closer_hires_one_active on public.closer_hires (member_id) where status = 'active';
alter table public.closer_hires enable row level security;
drop policy if exists ch_read on public.closer_hires;
create policy ch_read on public.closer_hires for select to authenticated using (member_id = auth.uid() or closer_id = auth.uid() or public.is_admin());

-- hire: calls is 1, 2, or null for every future call
create or replace function public.hire_closer(p_closer uuid, p_calls integer, p_note text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); nm text; hid uuid; what text;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_calls is not null and p_calls not in (1, 2) then raise exception 'choose one call, two calls or every call' using errcode = '22023'; end if;
  if p_closer = me or not public.is_call_closer(p_closer) then raise exception 'that person is not a call closer' using errcode = '22023'; end if;
  begin
    insert into public.closer_hires (member_id, closer_id, calls_total, note) values (me, p_closer, p_calls, nullif(left(btrim(coalesce(p_note, '')), 200), '')) returning id into hid;
  exception when unique_violation then raise exception 'you already have a call closer hired' using errcode = '23505';
  end;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = me;
  what := case p_calls when 1 then 'one call' when 2 then 'two calls' else 'all their future calls' end;
  perform public.notify_user(p_closer, 'announcement', nm || ' hired you for ' || what, 'Leads who book with them will be assigned to you.', '/call-closers');
  return hid;
end $$;
revoke all on function public.hire_closer(uuid, integer, text) from public, anon;
grant execute on function public.hire_closer(uuid, integer, text) to authenticated;

create or replace function public.end_closer_hire(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.closer_hires set status = 'ended', ended_at = now()
   where id = p_id and status = 'active' and (member_id = auth.uid() or public.is_admin());
end $$;
revoke all on function public.end_closer_hire(uuid) from public, anon;
grant execute on function public.end_closer_hire(uuid) to authenticated;

-- a call booked with no closer chosen goes to the hired closer, and counts toward a one-call or two-call hire
create or replace function public.booked_calls_assign_closer() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare h public.closer_hires;
begin
  if new.closer_id is not null then return new; end if;
  select * into h from public.closer_hires where member_id = new.member_id and status = 'active' for update;
  if h.id is null then return new; end if;
  new.closer_id := h.closer_id;
  update public.closer_hires set calls_used = calls_used + 1,
         status = case when calls_total is not null and calls_used + 1 >= calls_total then 'ended' else status end,
         ended_at = case when calls_total is not null and calls_used + 1 >= calls_total then now() else ended_at end
   where id = h.id;
  return new;
end $$;
drop trigger if exists booked_calls_assign on public.booked_calls;
create trigger booked_calls_assign before insert on public.booked_calls for each row execute function public.booked_calls_assign_closer();

notify pgrst, 'reload schema';
