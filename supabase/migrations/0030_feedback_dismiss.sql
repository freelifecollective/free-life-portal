-- "Don't ask me again for this call": remembered per person and per call.
create table public.feedback_dismissed (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  call_id      uuid not null references public.calls (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, call_id)
);
alter table public.feedback_dismissed enable row level security;
create policy fd_read on public.feedback_dismissed for select to authenticated using (user_id = auth.uid());
create policy fd_insert on public.feedback_dismissed for insert to authenticated with check (user_id = auth.uid());
create policy fd_delete on public.feedback_dismissed for delete to authenticated using (user_id = auth.uid());

-- same list as before, minus calls the person asked not to be asked about
create or replace function public.pending_feedback() returns table (call_id uuid, title text, starts_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, c.title, c.starts_at from public.calls c
  join public.call_attendance a on a.call_id = c.id and a.user_id = auth.uid()
  where c.starts_at + make_interval(mins => c.duration_minutes) < now()
    and c.starts_at + make_interval(mins => c.duration_minutes) > now() - interval '14 days'
    and not exists (select 1 from public.call_feedback f where f.call_id = c.id and f.user_id = auth.uid())
    and not exists (select 1 from public.feedback_dismissed d where d.call_id = c.id and d.user_id = auth.uid())
  order by c.starts_at desc limit 3
$$;
