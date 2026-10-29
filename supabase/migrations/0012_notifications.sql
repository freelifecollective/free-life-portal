-- Notifications: an in-app list with unread count, phone/desktop push subscriptions, announcements, call reminders, and the first-visit tour.

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('new_lead', 'call_reminder', 'submission_result', 'announcement', 'direct_message', 'payment')),
  title      text not null check (char_length(title) between 1 and 120),
  body       text check (body is null or char_length(body) <= 400),
  url        text check (url is null or url ~ '^/'),
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  pushed_at  timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy notif_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());
-- no insert policy: notifications are created by the database rules below or by the server with its secret key

-- Only the read marker may change.
create function public.notifications_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.user_id is distinct from old.user_id or new.kind is distinct from old.kind or new.title is distinct from old.title
       or new.body is distinct from old.body or new.url is distinct from old.url or new.pushed_at is distinct from old.pushed_at
       or new.created_at is distinct from old.created_at) then
    raise exception 'only the read marker can change' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function public.notifications_guard();

-- browsers/phones that agreed to receive push messages
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_own_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- which version of the tour each person has seen
create table public.member_tour (
  member_id    uuid primary key references public.profiles (id) on delete cascade,
  seen_version integer not null default 0
);
alter table public.member_tour enable row level security;
create policy tour_own_read on public.member_tour for select to authenticated using (member_id = auth.uid());
create policy tour_own_insert on public.member_tour for insert to authenticated with check (member_id = auth.uid());
create policy tour_own_update on public.member_tour for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

-- admin announcements ("a new feature is available") reach everyone
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  body       text check (body is null or char_length(body) <= 400),
  url        text check (url is null or url ~ '^/'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy ann_read on public.announcements for select to authenticated using (true);
create policy ann_admin_insert on public.announcements for insert to authenticated with check (public.is_admin());
create policy ann_admin_delete on public.announcements for delete to authenticated using (public.is_admin());

-- settings the database needs to reach the website (push address and shared secret); no policies = nobody but the owner can read them
create table public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------- helpers
create function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text default null, p_url text default null) returns void
language sql security definer set search_path = public, pg_temp
as $$ insert into public.notifications (user_id, kind, title, body, url) values (p_user, p_kind, p_title, p_body, p_url) $$;
revoke all on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;

-- After new notifications are stored, tell the website once (with all their ids) so it can send the phone/desktop push.
create function public.notifications_push() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_url text; v_secret text; v_ids jsonb;
begin
  select value into v_url from public.app_settings where key = 'push_url';
  select value into v_secret from public.app_settings where key = 'push_secret';
  if v_url is null or v_secret is null or to_regnamespace('net') is null then return null; end if;
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids from new_rows;
  begin
    execute 'select net.http_post(url := $1, headers := $2, body := $3)'
      using v_url, jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret), jsonb_build_object('ids', v_ids);
  exception when others then null;  -- a failed push must never block saving a notification
  end;
  return null;
end $$;
create trigger notifications_push after insert on public.notifications referencing new table as new_rows for each statement execute function public.notifications_push();

-- ---------------------------------------------------------------- what creates notifications
-- a new lead registers through someone's page
create function public.notify_new_lead() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.referrer_id is not null then
    perform public.notify_user(new.referrer_id, 'new_lead', 'You have a new lead!', coalesce(new.first_name, 'Someone') || ' ' || coalesce(new.last_name, '') || ' just registered through your page.', '/');
  end if;
  return new;
end $$;
create trigger registrations_notify after insert on public.registrations for each row execute function public.notify_new_lead();

-- a submitted resource / financing option is approved or declined
create function public.notify_submission_result() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare who uuid; what text; link text;
begin
  if new.status = old.status or new.status = 'pending' then return new; end if;
  if tg_table_name = 'resource_submissions' then who := new.submitter_id; what := 'resource'; link := '/chats/resources';
  else who := new.submitted_by; what := 'financing suggestion'; link := '/financing'; end if;
  if who is null then return new; end if;
  perform public.notify_user(who, 'submission_result',
    case when new.status = 'accepted' or new.status = 'approved' then 'Your ' || what || ' was approved!' else 'Your ' || what || ' was not accepted' end,
    new.title || coalesce(' - ' || new.review_note, ''), link);
  return new;
end $$;
create trigger resource_submissions_notify after update on public.resource_submissions for each row execute function public.notify_submission_result();
create trigger financing_options_notify after update on public.financing_options for each row execute function public.notify_submission_result();

-- an announcement goes to every finished profile
create function public.notify_announcement() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'announcement', new.title, new.body, new.url from public.profiles p where p.onboarded_at is not null;
  return new;
end $$;
create trigger announcements_notify after insert on public.announcements for each row execute function public.notify_announcement();

-- call reminders: one hour before and ten minutes before, for people who said they will be there live
create table public.call_reminders_sent (
  call_id uuid not null references public.calls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  which   text not null check (which in ('hour', 'ten')),
  primary key (call_id, user_id, which)
);
alter table public.call_reminders_sent enable row level security;

create function public.queue_call_reminders() returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; r record;
begin
  for r in
    select c.id as call_id, c.title, c.starts_at, s.which, rs.user_id
    from public.calls c
    join public.rsvps rs on rs.call_id = c.id and rs.mode = 'live'
    cross join (values ('hour', interval '60 minutes', interval '50 minutes'), ('ten', interval '10 minutes', interval '0 minutes')) as s(which, hi, lo)
    where c.starts_at - now() <= s.hi and c.starts_at - now() > s.lo
      and not exists (select 1 from public.call_reminders_sent x where x.call_id = c.id and x.user_id = rs.user_id and x.which = s.which)
  loop
    insert into public.call_reminders_sent (call_id, user_id, which) values (r.call_id, r.user_id, r.which);
    perform public.notify_user(r.user_id, 'call_reminder',
      case r.which when 'hour' then r.title || ' starts in about an hour' else r.title || ' starts in 10 minutes' end, null, '/calendar');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.queue_call_reminders() from public, anon, authenticated;

alter publication supabase_realtime add table public.notifications;

-- run the reminder check every 5 minutes where pg_cron exists (it does on Supabase)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('flc-call-reminders', '*/5 * * * *', 'select public.queue_call_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron could not be set up: %', sqlerrm;
end $$;
