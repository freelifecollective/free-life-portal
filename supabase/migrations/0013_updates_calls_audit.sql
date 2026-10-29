-- Important Updates chat (admins post, affiliates react, view counts), notifications for calls, financing by country,
-- and an activity log with undo for everything an admin changes.

-- ---------------------------------------------------------------- notification kinds
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment'));

-- ---------------------------------------------------------------- chat options
alter table public.chats
  add column posting text not null default 'all' check (posting in ('all', 'admins')),
  add column replies_allowed boolean not null default true,
  add column show_views boolean not null default false,
  add column notify_members boolean not null default false,
  add column divider_after boolean not null default false;

insert into public.chats (section_id, slug, name, description, sort, min_role, posting, replies_allowed, show_views, notify_members, divider_after)
values (2, 'important-updates', 'Important Updates', 'Official updates from the Free Life Collective team.', 0, 'member', 'admins', false, true, true, true);

create function public.can_post_chat(p_chat uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select public.can_see(c.min_role) and (c.posting = 'all' or public.is_admin()) from public.chats c where c.id = p_chat), false) $$;
create function public.can_reply_post(p_post uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select public.can_see(c.min_role) and (c.replies_allowed or public.is_admin())
                        from public.chat_posts p join public.chats c on c.id = p.chat_id where p.id = p_post), false) $$;
revoke all on function public.can_post_chat(uuid), public.can_reply_post(uuid) from public, anon;
grant execute on function public.can_post_chat(uuid), public.can_reply_post(uuid) to authenticated;

drop policy posts_insert on public.chat_posts;
create policy posts_insert on public.chat_posts for insert to authenticated
  with check (author_id = auth.uid() and public.can_post_chat(chat_id));
drop policy comments_insert on public.chat_comments;
create policy comments_insert on public.chat_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_reply_post(post_id));

-- who has seen each post (counted for chats with show_views)
create table public.chat_post_views (
  post_id uuid not null references public.chat_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.chat_post_views enable row level security;
create policy views_own on public.chat_post_views for select to authenticated using (user_id = auth.uid());

create function public.mark_posts_seen(p_posts uuid[]) returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.chat_post_views (post_id, user_id)
  select p.id, auth.uid() from public.chat_posts p join public.chats c on c.id = p.chat_id
  where p.id = any(p_posts) and c.show_views and p.author_id <> auth.uid() and public.can_see(c.min_role) and auth.uid() is not null
  on conflict do nothing
$$;
create function public.post_view_counts(p_posts uuid[]) returns table (post_id uuid, views integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select v.post_id, count(*)::integer from public.chat_post_views v
  where v.post_id = any(p_posts) and public.can_see_chat(public.post_chat(v.post_id))
  group by v.post_id
$$;
revoke all on function public.mark_posts_seen(uuid[]), public.post_view_counts(uuid[]) from public, anon;
grant execute on function public.mark_posts_seen(uuid[]), public.post_view_counts(uuid[]) to authenticated;

-- a post in a chat with notify_members goes to every affiliate
create function public.notify_chat_post() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_setting('flc.undoing', true) = 'on' then return new; end if;
  if exists (select 1 from public.chats c where c.id = new.chat_id and c.notify_members) then
    insert into public.notifications (user_id, kind, title, body, url)
      select p.id, 'important_update', 'Important update', left(new.body, 140), '/chats/' || (select slug from public.chats where id = new.chat_id)
      from public.profiles p where p.onboarded_at is not null and p.role in ('member', 'admin') and p.id <> new.author_id;
  end if;
  return new;
end $$;
create trigger chat_posts_notify after insert on public.chat_posts for each row execute function public.notify_chat_post();

-- ---------------------------------------------------------------- calls: new call + reminders for everyone who can see it
create function public.call_audience_users(p_call uuid) returns table (user_id uuid)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id from public.profiles p join public.calls c on c.id = p_call
  where p.onboarded_at is not null and (c.audience = 'leads_open' or p.role in ('member', 'admin'))
$$;
revoke all on function public.call_audience_users(uuid) from public, anon, authenticated;

create function public.notify_new_call() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_setting('flc.undoing', true) = 'on' then return new; end if;
  insert into public.notifications (user_id, kind, title, body, url)
    select u.user_id, 'call_new', 'New call: ' || new.title,
           to_char(new.starts_at at time zone 'America/New_York', 'FMDay, FMMon FMDD "at" FMHH12:MI AM') || ' ET', '/calendar'
    from public.call_audience_users(new.id) u;
  return new;
end $$;
create trigger calls_notify after insert on public.calls for each row execute function public.notify_new_call();

alter table public.call_reminders_sent drop constraint call_reminders_sent_which_check;
alter table public.call_reminders_sent add constraint call_reminders_sent_which_check check (which in ('hour', 'ten', 'day', 'live'));

-- Reminders go to everyone who can see the call, whether or not they pressed RSVP: 24 hours, 1 hour, 10 minutes, and when it starts.
create or replace function public.queue_call_reminders() returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; r record;
begin
  for r in
    select c.id as call_id, c.title, s.which, u.user_id
    from public.calls c
    cross join (values ('day', interval '24 hours', interval '23 hours 50 minutes'),
                       ('hour', interval '60 minutes', interval '50 minutes'),
                       ('ten', interval '10 minutes', interval '0 minutes'),
                       ('live', interval '0 minutes', interval '-5 minutes')) as s(which, hi, lo)
    cross join lateral public.call_audience_users(c.id) u
    where c.starts_at - now() <= s.hi and c.starts_at - now() > s.lo
      and not exists (select 1 from public.call_reminders_sent x where x.call_id = c.id and x.user_id = u.user_id and x.which = s.which)
  loop
    insert into public.call_reminders_sent (call_id, user_id, which) values (r.call_id, r.user_id, r.which);
    perform public.notify_user(r.user_id, 'call_reminder',
      case r.which when 'day' then r.title || ' is tomorrow' when 'hour' then r.title || ' starts in about an hour'
                   when 'ten' then r.title || ' starts in 10 minutes' else r.title || ' is live now!' end,
      case r.which when 'live' then 'Tap to join.' else null end, '/calendar');
    n := n + 1;
  end loop;
  return n;
end $$;

-- the other notification makers pause while an admin undoes something
create or replace function public.notify_announcement() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_setting('flc.undoing', true) = 'on' then return new; end if;
  insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'announcement', new.title, new.body, new.url from public.profiles p where p.onboarded_at is not null;
  return new;
end $$;
create or replace function public.notify_submission_result() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare who uuid; what text; link text;
begin
  if current_setting('flc.undoing', true) = 'on' then return new; end if;
  if new.status = old.status or new.status = 'pending' then return new; end if;
  if tg_table_name = 'resource_submissions' then who := new.submitter_id; what := 'resource'; link := '/chats/resources';
  else who := new.submitted_by; what := 'financing suggestion'; link := '/financing'; end if;
  if who is null then return new; end if;
  perform public.notify_user(who, 'submission_result',
    case when new.status = 'accepted' or new.status = 'approved' then 'Your ' || what || ' was approved!' else 'Your ' || what || ' was not accepted' end,
    new.title || coalesce(' - ' || new.review_note, ''), link);
  return new;
end $$;

-- ---------------------------------------------------------------- financing by country
alter table public.financing_options
  add column country text not null default 'USA' check (country in ('USA', 'Canada', 'Australia', 'New Zealand', 'Germany', 'United Kingdom'));
drop index public.financing_title_unique;
create unique index financing_title_unique on public.financing_options (country, lower(btrim(title))) where status <> 'declined';

-- ---------------------------------------------------------------- activity log with undo
create table public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null check (action in ('insert', 'update', 'delete', 'undo')),
  table_name   text not null,
  summary      text not null,
  before_row   jsonb,
  after_row    jsonb,
  changed_cols text[],
  created_at   timestamptz not null default now(),
  undone_at    timestamptz,
  undone_by    uuid references public.profiles (id) on delete set null,
  undo_of      bigint references public.audit_log (id)
);
create index audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());

create function public.audit_label(t text) returns text language sql immutable as $$
  select case t when 'calls' then 'call' when 'signup_allowlist' then 'invite' when 'profiles' then 'person' when 'financing_options' then 'financing option'
    when 'resource_submissions' then 'resource submission' when 'announcements' then 'announcement' when 'chats' then 'chat' when 'chat_sections' then 'chat section'
    when 'payments' then 'payment' when 'chat_posts' then 'post' when 'chat_comments' then 'reply' else t end $$;

create function public.audit_row() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  o jsonb; n jsonb; r jsonb; cols text[]; act text; nm text;
begin
  if current_setting('flc.undoing', true) = 'on' or actor is null then return null; end if;
  if not exists (select 1 from public.profiles where id = actor and role = 'admin') then return null; end if;
  o := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r := coalesce(n, o);
  if tg_table_name = 'profiles' and (tg_op <> 'UPDATE' or (r->>'id')::uuid = actor) then return null; end if;
  if tg_table_name = 'chat_posts' and ((tg_op = 'DELETE' and (o->>'author_id')::uuid = actor) or tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and o->>'pinned_at' is not distinct from n->>'pinned_at')) then return null; end if;
  if tg_table_name = 'chat_comments' and (tg_op <> 'DELETE' or (o->>'author_id')::uuid = actor) then return null; end if;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into cols from jsonb_object_keys(n) k where o->k is distinct from n->k and k not in ('updated_at');
    if cols is null then return null; end if;
  end if;
  act := lower(tg_op);
  nm := coalesce(r->>'title', r->>'email', r->>'username', r->>'name', r->>'first_name', left(r->>'body', 40),
                 case when tg_table_name = 'payments' then '$' || ((r->>'amount_cents')::numeric / 100)::text end, r->>'id');
  insert into public.audit_log (actor_id, action, table_name, summary, before_row, after_row, changed_cols)
  values (actor, act, tg_table_name,
          case act when 'insert' then 'Added ' when 'delete' then 'Removed ' else 'Changed ' end || public.audit_label(tg_table_name) || ' "' || nm || '"'
            || case when cols is not null then ' (' || array_to_string(cols, ', ') || ')' else '' end,
          o, n, cols);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['calls', 'signup_allowlist', 'profiles', 'financing_options', 'resource_submissions', 'announcements', 'chats', 'chat_sections', 'payments', 'chat_posts', 'chat_comments'] loop
    execute format('create trigger zz_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- Undo one logged action. Only admins; not for entries already undone.
create function public.undo_audit(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e public.audit_log;
  pk text[]; where_sql text; src jsonb; setlist text; msg text;
  tbl text;
begin
  if not public.is_admin() then raise exception 'only admins can undo' using errcode = '42501'; end if;
  select * into e from public.audit_log where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Not found.'); end if;
  if e.undone_at is not null or e.action = 'undo' then return jsonb_build_object('ok', false, 'reason', 'This was already undone, or cannot be undone.'); end if;
  tbl := e.table_name;
  if tbl <> all (array['calls', 'signup_allowlist', 'profiles', 'financing_options', 'resource_submissions', 'announcements', 'chats', 'chat_sections', 'payments', 'chat_posts', 'chat_comments']) then
    return jsonb_build_object('ok', false, 'reason', 'Not supported.');
  end if;

  select array_agg(a.attname::text order by a.attnum) into pk
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
   where i.indrelid = format('public.%I', tbl)::regclass and i.indisprimary;
  src := coalesce(e.after_row, e.before_row);
  select string_agg(format('t.%I = ($2->>%L)::%s', k, k, (select format_type(a.atttypid, a.atttypmod) from pg_attribute a where a.attrelid = format('public.%I', tbl)::regclass and a.attname = k)), ' and ')
    into where_sql from unnest(pk) k;

  perform set_config('flc.undoing', 'on', true);
  begin
    if e.action = 'insert' then
      execute format('delete from public.%I t where %s', tbl, where_sql) using null::text, src;
    elsif e.action = 'delete' then
      execute format('insert into public.%I overriding system value select r.* from jsonb_populate_record(null::public.%I, $1) r', tbl, tbl) using e.before_row;
    else
      select string_agg(format('%I = r.%I', c, c), ', ') into setlist from unnest(e.changed_cols) c;
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where %s', tbl, setlist, tbl, where_sql) using e.before_row, src;
    end if;
  exception when others then
    get stacked diagnostics msg = message_text;
    perform set_config('flc.undoing', 'off', true);
    return jsonb_build_object('ok', false, 'reason', 'Could not undo: ' || msg);
  end;
  perform set_config('flc.undoing', 'off', true);

  update public.audit_log set undone_at = now(), undone_by = auth.uid() where id = e.id;
  insert into public.audit_log (actor_id, action, table_name, summary, undo_of)
    values (auth.uid(), 'undo', tbl, 'Undid: ' || e.summary, e.id);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.undo_audit(bigint) from public, anon;
grant execute on function public.undo_audit(bigint) to authenticated;
