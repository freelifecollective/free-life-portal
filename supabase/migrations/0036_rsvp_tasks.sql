-- RSVPs and attendance feed the to-do list: RSVP to a call and it lands on that day's list; show up and it is ticked off.

alter table public.tasks
  add column if not exists source_call_id uuid references public.calls (id) on delete cascade,
  add column if not exists source_kind text check (source_kind in ('live', 'replay'));
create unique index if not exists tasks_one_per_call on public.tasks (user_id, source_call_id) where source_call_id is not null;

-- the person's own date for a moment (their saved time zone, or Eastern)
create or replace function public.local_day(p_user uuid, p_at timestamptz) returns date
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare zone text;
begin
  select tz into zone from public.member_prefs where member_id = p_user;
  begin return (p_at at time zone coalesce(zone, 'America/New_York'))::date;
  exception when others then return (p_at at time zone 'America/New_York')::date; end;
end $$;
revoke all on function public.local_day(uuid, timestamptz) from public, anon, authenticated;

-- RSVP to come live: "Join live: <call>" on the day of the call. RSVP to watch the replay: "Watch the replay: <call>" the day after.
-- Taking the RSVP back removes it again. Only affiliates have a to-do list.
create or replace function public.sync_rsvp_task() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare c public.calls; kind text; ttl text; due date; pos integer;
begin
  if tg_op = 'DELETE' then
    delete from public.tasks where user_id = old.user_id and source_call_id = old.call_id and done_on is null;
    return old;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.role in ('member', 'admin') and p.removed_at is null) then return new; end if;
  select * into c from public.calls where id = new.call_id;
  if not found then return new; end if;
  kind := case new.mode when 'live' then 'live' else 'replay' end;
  ttl := left(case kind when 'live' then 'Join live: ' else 'Watch the replay: ' end || c.title, 120);
  due := public.local_day(new.user_id, c.starts_at) + case kind when 'replay' then 1 else 0 end;
  select coalesce(max(position), 0) + 1 into pos from public.tasks where user_id = new.user_id;
  insert into public.tasks (user_id, area, title, repeat, due_on, position, source_call_id, source_kind)
    values (new.user_id, 'business', ttl, 'once', due, pos, new.call_id, kind)
  on conflict (user_id, source_call_id) where source_call_id is not null do update
    set title = excluded.title, due_on = excluded.due_on, source_kind = excluded.source_kind, done_on = null, prev_due_on = null
    where public.tasks.source_kind is distinct from excluded.source_kind;
  return new;
end $$;
drop trigger if exists rsvp_task on public.rsvps;
create trigger rsvp_task after insert or update of mode or delete on public.rsvps for each row execute function public.sync_rsvp_task();

-- Joining the live call ticks off "Join live"
create or replace function public.tick_live_task() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.tasks set done_on = public.local_day(new.user_id, now()), prev_due_on = due_on
   where user_id = new.user_id and source_call_id = new.call_id and source_kind = 'live' and done_on is null;
  return new;
end $$;
drop trigger if exists attendance_task on public.call_attendance;
create trigger attendance_task after insert on public.call_attendance for each row execute function public.tick_live_task();

-- Watching the replay (80% or more) ticks off "Watch the replay"
create or replace function public.tick_replay_task() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    update public.tasks t set done_on = public.local_day(new.user_id, now()), prev_due_on = t.due_on
      from public.recordings r
     where r.id = new.recording_id and t.user_id = new.user_id and t.source_call_id = r.call_id and t.done_on is null;
  end if;
  return new;
end $$;
drop trigger if exists replay_task on public.recording_views;
create trigger replay_task after update on public.recording_views for each row execute function public.tick_replay_task();
create or replace function public.tick_replay_task_new() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.completed_at is not null then
    update public.tasks t set done_on = public.local_day(new.user_id, now()), prev_due_on = t.due_on
      from public.recordings r
     where r.id = new.recording_id and t.user_id = new.user_id and t.source_call_id = r.call_id and t.done_on is null;
  end if;
  return new;
end $$;
drop trigger if exists replay_task_new on public.recording_views;
create trigger replay_task_new after insert on public.recording_views for each row execute function public.tick_replay_task_new();

-- Tasks made from RSVPs are left out of the task reminders: calls already send their own reminders.
create or replace function public.queue_task_reminders() returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; r record; local_now timestamp; local_day date; hr integer;
begin
  for r in
    select t.*, coalesce(mp.tz, 'America/New_York') as zone
      from public.tasks t
      join public.profiles p on p.id = t.user_id and p.removed_at is null and p.role in ('member', 'admin')
      left join public.member_prefs mp on mp.member_id = t.user_id
     where t.repeat <> 'daily' and t.source_call_id is null and t.due_on is not null and (t.done_on is null or t.repeat <> 'once')
  loop
    begin
      local_now := now() at time zone r.zone;
    exception when others then
      local_now := now() at time zone 'America/New_York';
    end;
    local_day := local_now::date;
    hr := extract(hour from local_now)::integer;
    -- a repeating task that was just ticked off for this round is not due again until its new date
    if r.repeat <> 'once' and r.done_on = local_day and r.due_on > local_day then continue; end if;

    if r.due_on = local_day + 1 and hr >= 9 and r.tomorrow_nudged_for is distinct from r.due_on then
      update public.tasks set tomorrow_nudged_for = r.due_on where id = r.id;
      perform public.notify_user(r.user_id, 'task', 'Due tomorrow: ' || r.title, 'You have a task coming up.', '/tasks');
      n := n + 1;
    elsif r.due_on = local_day and hr >= 8 and r.today_nudged_for is distinct from r.due_on then
      update public.tasks set today_nudged_for = r.due_on where id = r.id;
      perform public.notify_user(r.user_id, 'task', 'Due today: ' || r.title, 'Tick it off when it is done.', '/tasks');
      n := n + 1;
    elsif r.due_on < local_day and hr >= 9 and r.overdue_nudges < 3 and (r.overdue_nudged_on is null or r.overdue_nudged_on <= local_day - 3) then
      update public.tasks set overdue_nudged_on = local_day, overdue_nudges = r.overdue_nudges + 1 where id = r.id;
      perform public.notify_user(r.user_id, 'task', 'Overdue: ' || r.title, 'This was due ' || to_char(r.due_on, 'FMMon FMDD') || '. A small first step still counts.', '/tasks');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
