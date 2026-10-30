-- Feedback on a call can be left by anyone who was there live, or who has watched (at least 80% of) the replay. (safe to run more than once)
drop policy if exists fb_insert on public.call_feedback;
create policy fb_insert on public.call_feedback for insert to authenticated with check (
  user_id = auth.uid()
  and (
    exists (select 1 from public.call_attendance a where a.call_id = call_feedback.call_id and a.user_id = auth.uid())
    or exists (select 1 from public.recording_views v join public.recordings r on r.id = v.recording_id
                where r.call_id = call_feedback.call_id and v.user_id = auth.uid() and v.completed_at is not null))
  and exists (select 1 from public.calls c where c.id = call_feedback.call_id and c.starts_at + make_interval(mins => c.duration_minutes) < now()));
