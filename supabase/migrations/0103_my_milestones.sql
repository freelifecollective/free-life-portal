-- Coaching calls and sales are logged by the person themselves (on their own profile), not by an admin.
drop policy if exists me_self_insert on public.milestone_events;
create policy me_self_insert on public.milestone_events for insert to authenticated
  with check (member_id = auth.uid() and logged_by = auth.uid() and public.can_see('member')
              and happened_on <= current_date + 1 and happened_on > current_date - 400);
drop policy if exists me_self_delete on public.milestone_events;
create policy me_self_delete on public.milestone_events for delete to authenticated
  using (member_id = auth.uid() and logged_by = auth.uid());
