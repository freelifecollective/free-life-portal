-- A hire is now a request: the closer accepts or declines. Calls only go to a closer once they have accepted.
alter table public.closer_hires drop constraint if exists closer_hires_status_check;
alter table public.closer_hires add constraint closer_hires_status_check check (status in ('pending', 'active', 'ended', 'declined'));
alter table public.closer_hires add column if not exists response_note text check (response_note is null or char_length(response_note) <= 200);
alter table public.closer_hires add column if not exists responded_at timestamptz;
drop index if exists public.closer_hires_one_active;
create unique index if not exists closer_hires_one_open on public.closer_hires (member_id) where status in ('pending', 'active');

create or replace function public.hire_closer(p_closer uuid, p_calls integer, p_note text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); nm text; hid uuid; what text;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_calls is not null and p_calls not in (1, 2) then raise exception 'choose one call, two calls or every call' using errcode = '22023'; end if;
  if p_closer = me or not public.is_call_closer(p_closer) then raise exception 'that person is not a call closer' using errcode = '22023'; end if;
  begin
    insert into public.closer_hires (member_id, closer_id, calls_total, note, status) values (me, p_closer, p_calls, nullif(left(btrim(coalesce(p_note, '')), 200), ''), 'pending') returning id into hid;
  exception when unique_violation then raise exception 'you already have a call closer hired' using errcode = '23505';
  end;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = me;
  what := case p_calls when 1 then 'one call' when 2 then 'two calls' else 'all their future calls' end;
  perform public.notify_user(p_closer, 'announcement', nm || ' wants to hire you for ' || what, 'Open Call Closers for Hire to accept or decline.', '/call-closers');
  return hid;
end $$;

-- the closer answers a request
create or replace function public.respond_closer_hire(p_id uuid, p_accept boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare h public.closer_hires; nm text;
begin
  select * into h from public.closer_hires where id = p_id and closer_id = auth.uid() and status = 'pending' for update;
  if h.id is null then raise exception 'that request is not waiting' using errcode = 'P0002'; end if;
  update public.closer_hires set status = case when p_accept then 'active' else 'declined' end, responded_at = now(),
         response_note = nullif(left(btrim(coalesce(p_note, '')), 200), '') where id = p_id;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Your call closer') into nm from public.profiles where id = h.closer_id;
  if p_accept then
    perform public.notify_user(h.member_id, 'announcement', nm || ' accepted your hire', 'They will take the calls you asked for.', '/call-closers');
  else
    perform public.notify_user(h.member_id, 'announcement', nm || ' cannot take your calls right now', nullif(left(btrim(coalesce(p_note, '')), 200), ''), '/call-closers');
  end if;
end $$;
revoke all on function public.respond_closer_hire(uuid, boolean, text) from public, anon;
grant execute on function public.respond_closer_hire(uuid, boolean, text) to authenticated;

-- the member can stop (or take back a request); the closer can stop a hire they accepted
create or replace function public.end_closer_hire(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare h public.closer_hires; nm text;
begin
  select * into h from public.closer_hires where id = p_id and status in ('pending', 'active') and (member_id = auth.uid() or closer_id = auth.uid() or public.is_admin()) for update;
  if h.id is null then return; end if;
  update public.closer_hires set status = 'ended', ended_at = now() where id = p_id;
  if h.closer_id = auth.uid() and h.status = 'active' then
    select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Your call closer') into nm from public.profiles where id = h.closer_id;
    perform public.notify_user(h.member_id, 'announcement', nm || ' has stopped taking your calls', 'New calls go back to you. You can hire someone else any time.', '/call-closers');
  end if;
end $$;

notify pgrst, 'reload schema';
