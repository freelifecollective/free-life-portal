-- Tasks: personal to-do lists for business and life, with repeats, reminders and ordering.

-- each person's time zone, so "today" and reminder times are theirs (the browser fills it in)
alter table public.member_prefs add column tz text check (tz is null or char_length(tz) between 1 and 64);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  area          text not null default 'business' check (area in ('business', 'personal')),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  note          text check (note is null or char_length(note) <= 1000),
  repeat        text not null default 'once' check (repeat in ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'once')),
  due_on        date,       -- one-off: optional. Weekly/monthly/quarterly/annual: the next due date. Daily: not used.
  position      integer not null default 0,
  done_on       date,       -- the day it was last ticked off (in the person's time zone)
  prev_due_on   date,       -- the due date before it was ticked off, so un-ticking can put it back
  created_at    timestamptz not null default now(),
  -- bookkeeping so each reminder is sent once
  tomorrow_nudged_for date,
  today_nudged_for    date,
  overdue_nudged_on   date,
  overdue_nudges      integer not null default 0,
  constraint tasks_due_needed check (repeat in ('daily', 'once') or due_on is not null)
);
create index tasks_user_idx on public.tasks (user_id, position);
alter table public.tasks enable row level security;
create policy tasks_own_read on public.tasks for select to authenticated using (user_id = auth.uid());
create policy tasks_own_insert on public.tasks for insert to authenticated with check (user_id = auth.uid() and public.can_see('member'));
create policy tasks_own_update on public.tasks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tasks_own_delete on public.tasks for delete to authenticated using (user_id = auth.uid());

-- a new due date means the old reminders no longer apply
create function public.tasks_reset_nudges() returns trigger language plpgsql as $$
begin
  if new.due_on is distinct from old.due_on then
    new.tomorrow_nudged_for := null; new.today_nudged_for := null; new.overdue_nudged_on := null; new.overdue_nudges := 0;
  end if;
  return new;
end $$;
create trigger tasks_reset_nudges before update on public.tasks for each row execute function public.tasks_reset_nudges();

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing', 'accountability', 'recording', 'task'));

-- Reminders for tasks that are not daily: the morning before (9am), the morning of (8am), and if it is overdue (9am, then every
-- 3 days, up to 3 times). Times are the person's own. Run every 15 minutes.
create function public.queue_task_reminders() returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; r record; local_now timestamp; local_day date; hr integer;
begin
  for r in
    select t.*, coalesce(mp.tz, 'America/New_York') as zone
      from public.tasks t
      join public.profiles p on p.id = t.user_id and p.removed_at is null and p.role in ('member', 'admin')
      left join public.member_prefs mp on mp.member_id = t.user_id
     where t.repeat <> 'daily' and t.due_on is not null and (t.done_on is null or t.repeat <> 'once')
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
revoke all on function public.queue_task_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('flc-task-reminders', '*/15 * * * *', 'select public.queue_task_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron could not be set up: %', sqlerrm;
end $$;
