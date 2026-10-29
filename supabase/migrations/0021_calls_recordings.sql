-- Calls tab: recordings (hosted on Vimeo), who joined live calls through the portal, and after-call feedback.

-- ---------------------------------------------------------------- recordings
create table public.recordings (
  id            uuid primary key default gen_random_uuid(),
  call_id       uuid references public.calls (id) on delete set null,
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  description   text check (description is null or char_length(description) <= 2000),
  recorded_at   timestamptz not null default now(),
  vimeo_id      text not null check (vimeo_id ~ '^[0-9]{5,14}$'),
  vimeo_hash    text check (vimeo_hash is null or vimeo_hash ~ '^[a-z0-9]{6,32}$'),
  thumb_url     text check (thumb_url is null or thumb_url ~ '^https://'),
  duration_secs integer check (duration_secs is null or duration_secs between 0 and 86400),
  start_secs    integer not null default 0 check (start_secs between 0 and 86400),
  end_secs      integer check (end_secs is null or end_secs between 1 and 86400),
  for_leads     boolean not null default false,
  for_downline  boolean not null default false,
  published     boolean not null default false,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  check (end_secs is null or end_secs > start_secs)
);
create index recordings_recorded_idx on public.recordings (recorded_at desc);
alter table public.recordings enable row level security;
-- Paying affiliates see every published recording; leads only the ones switched on for them. Admins see all, drafts included.
create policy rec_read on public.recordings for select to authenticated using (
  public.is_admin() or (published and (public.can_see('member') or (for_leads and public.app_current_role() = 'lead'))));
create policy rec_admin on public.recordings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- who joined a live call through the portal
create table public.call_attendance (
  call_id   uuid not null references public.calls (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (call_id, user_id)
);
alter table public.call_attendance enable row level security;
create policy att_own on public.call_attendance for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Pressing Join records that you came (only around the time of the call), and hands back the link.
create function public.join_call(p_call uuid) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c public.calls;
begin
  if auth.uid() is null then return null; end if;
  select * into c from public.calls k where k.id = p_call
    and (public.can_see('member') or (k.audience = 'leads_open' and public.can_see('lead')));
  if not found then return null; end if;
  if now() >= c.starts_at - interval '30 minutes' and now() <= c.starts_at + make_interval(mins => c.duration_minutes) + interval '60 minutes' then
    insert into public.call_attendance (call_id, user_id) values (c.id, auth.uid()) on conflict do nothing;
  end if;
  return c.join_url;
end $$;
revoke all on function public.join_call(uuid) from public, anon;
grant execute on function public.join_call(uuid) to authenticated;

-- ---------------------------------------------------------------- feedback
create table public.call_feedback (
  call_id   uuid not null references public.calls (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  thoughts  text not null check (char_length(btrim(thoughts)) between 1 and 1500),
  favourite text not null check (char_length(btrim(favourite)) between 1 and 1500),
  takeaway  text not null check (char_length(btrim(takeaway)) between 1 and 1500),
  created_at timestamptz not null default now(),
  primary key (call_id, user_id)
);
alter table public.call_feedback enable row level security;
create policy fb_own_read on public.call_feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy fb_insert on public.call_feedback for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.call_attendance a where a.call_id = call_feedback.call_id and a.user_id = auth.uid())
  and exists (select 1 from public.calls c where c.id = call_feedback.call_id and c.starts_at + make_interval(mins => c.duration_minutes) < now()));
create policy fb_delete_admin on public.call_feedback for delete to authenticated using (public.is_admin());

-- Calls you joined live that ended in the last two weeks and still need your feedback.
create function public.pending_feedback() returns table (call_id uuid, title text, starts_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, c.title, c.starts_at from public.calls c
  join public.call_attendance a on a.call_id = c.id and a.user_id = auth.uid()
  where c.starts_at + make_interval(mins => c.duration_minutes) < now()
    and c.starts_at + make_interval(mins => c.duration_minutes) > now() - interval '14 days'
    and not exists (select 1 from public.call_feedback f where f.call_id = c.id and f.user_id = auth.uid())
  order by c.starts_at desc limit 3
$$;
revoke all on function public.pending_feedback() from public, anon;
grant execute on function public.pending_feedback() to authenticated;

-- Everyone's feedback for a call: shown to people who gave their own, and to admins.
create function public.call_feedback_all(p_call uuid) returns table (first_name text, last_name text, avatar_url text, thoughts text, favourite text, takeaway text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.first_name, p.last_name, p.avatar_url, f.thoughts, f.favourite, f.takeaway, f.created_at
  from public.call_feedback f join public.profiles p on p.id = f.user_id
  where f.call_id = p_call
    and (public.is_admin() or exists (select 1 from public.call_feedback mine where mine.call_id = p_call and mine.user_id = auth.uid()))
  order by f.created_at desc
$$;
revoke all on function public.call_feedback_all(uuid) from public, anon;
grant execute on function public.call_feedback_all(uuid) to authenticated;

-- ---------------------------------------------------------------- tell people when a recording goes live
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing', 'accountability', 'recording'));

create function public.notify_recording() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_setting('flc.undoing', true) = 'on' then return new; end if;
  if new.published and (tg_op = 'INSERT' or not old.published) then
    insert into public.notifications (user_id, kind, title, body, url)
      select p.id, 'recording', 'New recording: ' || new.title, null, '/calls/' || new.id
      from public.profiles p
      where p.onboarded_at is not null and (p.role in ('member', 'admin') or (p.role = 'lead' and new.for_leads))
        and (new.call_id is null or exists (select 1 from public.call_attendance a where a.call_id = new.call_id and a.user_id = p.id)
             or exists (select 1 from public.rsvps r where r.call_id = new.call_id and r.user_id = p.id));
  end if;
  return new;
end $$;
create trigger recordings_notify after insert or update on public.recordings for each row execute function public.notify_recording();

-- ---------------------------------------------------------------- activity log
create or replace function public.audit_tables() returns text[] language sql immutable as $$
  select array['calls', 'signup_allowlist', 'profiles', 'financing_options', 'resource_submissions', 'announcements', 'chats', 'chat_sections', 'payments', 'chat_posts', 'chat_comments', 'outsourcing_profiles', 'outsourcing_hires', 'doc_folders', 'doc_files', 'recordings'] $$;
create or replace function public.audit_label(t text) returns text language sql immutable as $$
  select case t when 'calls' then 'call' when 'signup_allowlist' then 'invite' when 'profiles' then 'person' when 'financing_options' then 'financing option'
    when 'resource_submissions' then 'resource submission' when 'announcements' then 'announcement' when 'chats' then 'chat' when 'chat_sections' then 'chat section'
    when 'payments' then 'payment' when 'chat_posts' then 'post' when 'chat_comments' then 'reply' when 'outsourcing_profiles' then 'outsourcing listing'
    when 'outsourcing_hires' then 'outsourcing review' when 'doc_folders' then 'folder' when 'doc_files' then 'document' when 'recordings' then 'recording' else t end $$;
create trigger zz_audit after insert or update or delete on public.recordings for each row execute function public.audit_row();
