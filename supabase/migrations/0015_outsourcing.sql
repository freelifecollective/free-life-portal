-- Outsourcing directory (affiliates offer help, others hire and review), plus the member status fields the paid-status rules need.

alter table public.profiles add column unpaid_since date, add column removed_at timestamptz;

create or replace function public.profiles_before_write() returns trigger
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  by_user boolean := current_user in ('authenticated', 'anon');
begin
  new.updated_at := now();

  if new.username is not null then
    new.username := lower(new.username::text)::citext;
    if (tg_op = 'INSERT' or new.username is distinct from old.username)
       and public.is_reserved_username(new.username::text) then
      raise exception 'username_reserved' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and by_user and not public.is_admin() then
    if new.id is distinct from old.id then raise exception 'profile id is immutable' using errcode = '42501'; end if;
    if new.email is distinct from old.email then raise exception 'email cannot be changed here' using errcode = '42501'; end if;
    if new.role is distinct from old.role then raise exception 'role can only be changed by an admin' using errcode = '42501'; end if;
    if new.coach_id is distinct from old.coach_id then raise exception 'coach can only be changed by an admin' using errcode = '42501'; end if;
    if new.unpaid_since is distinct from old.unpaid_since or new.removed_at is distinct from old.removed_at then
      raise exception 'membership status can only be changed by an admin' using errcode = '42501';
    end if;
    if old.onboarded_at is not null and new.onboarded_at is distinct from old.onboarded_at then
      raise exception 'onboarding is already complete' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- An affiliate who is still in good standing: not removed, and not unpaid for two months or more.
create function public.is_active_affiliate(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles p where p.id = p_id and p.role in ('member', 'admin') and p.onboarded_at is not null
                 and p.removed_at is null and (p.unpaid_since is null or p.unpaid_since > (current_date - interval '2 months')::date))
$$;
revoke all on function public.is_active_affiliate(uuid) from public, anon;
grant execute on function public.is_active_affiliate(uuid) to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing'));

-- ---------------------------------------------------------------- listings
create table public.outsourcing_profiles (
  member_id         uuid primary key references public.profiles (id) on delete cascade,
  headline          text not null check (char_length(btrim(headline)) between 1 and 100),
  about             text check (about is null or char_length(about) <= 1500),
  tasks             text[] not null default '{}' check (cardinality(tasks) between 1 and 12),
  hourly_rate_cents integer not null check (hourly_rate_cents between 100 and 100000),
  listed            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.outsourcing_profiles enable row level security;
create policy op_read on public.outsourcing_profiles for select to authenticated
  using (member_id = auth.uid() or (public.can_see('member') and listed and public.is_active_affiliate(member_id)));
create policy op_insert on public.outsourcing_profiles for insert to authenticated with check (member_id = auth.uid() and public.can_see('member'));
create policy op_update on public.outsourcing_profiles for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid() and public.can_see('member'));
create policy op_delete on public.outsourcing_profiles for delete to authenticated using (member_id = auth.uid() or public.is_admin());

-- who has hired whom, with an optional review
create table public.outsourcing_hires (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  hirer_id    uuid not null references public.profiles (id) on delete cascade,
  hired_at    timestamptz not null default now(),
  rating      smallint check (rating between 1 and 5),
  review      text check (review is null or char_length(review) <= 1000),
  reviewed_at timestamptz,
  unique (provider_id, hirer_id),
  check (provider_id <> hirer_id)
);
alter table public.outsourcing_hires enable row level security;
create policy oh_read on public.outsourcing_hires for select to authenticated
  using (hirer_id = auth.uid() or provider_id = auth.uid() or (public.can_see('member') and public.is_active_affiliate(provider_id)));
create policy oh_insert on public.outsourcing_hires for insert to authenticated
  with check (hirer_id = auth.uid() and public.can_see('member') and public.is_active_affiliate(provider_id)
              and exists (select 1 from public.outsourcing_profiles o where o.member_id = provider_id and o.listed));
create policy oh_update on public.outsourcing_hires for update to authenticated using (hirer_id = auth.uid()) with check (hirer_id = auth.uid());
create policy oh_delete on public.outsourcing_hires for delete to authenticated using (hirer_id = auth.uid() or public.is_admin());

-- nobody can rewrite who was hired, only the rating and review
create function public.oh_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('authenticated', 'anon') and (new.provider_id is distinct from old.provider_id or new.hirer_id is distinct from old.hirer_id or new.hired_at is distinct from old.hired_at) then
    raise exception 'only the review can change' using errcode = '42501';
  end if;
  if new.rating is distinct from old.rating or new.review is distinct from old.review then new.reviewed_at := now(); end if;
  return new;
end $$;
create trigger oh_guard before update on public.outsourcing_hires for each row execute function public.oh_guard();

-- the directory: listings of people in good standing, with their hire count and ratings
create function public.outsourcing_directory() returns table (
  member_id uuid, first_name text, last_name text, username citext, avatar_url text, is_admin boolean,
  headline text, about text, tasks text[], hourly_rate_cents integer, hires integer, reviews integer, avg_rating numeric)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.member_id, p.first_name, p.last_name, p.username, p.avatar_url, p.role = 'admin',
         o.headline, o.about, o.tasks, o.hourly_rate_cents,
         (select count(*)::integer from public.outsourcing_hires h where h.provider_id = o.member_id),
         (select count(*)::integer from public.outsourcing_hires h where h.provider_id = o.member_id and h.rating is not null),
         (select round(avg(h.rating)::numeric, 1) from public.outsourcing_hires h where h.provider_id = o.member_id and h.rating is not null)
  from public.outsourcing_profiles o join public.profiles p on p.id = o.member_id
  where public.can_see('member') and o.listed and public.is_active_affiliate(o.member_id)
  order by p.first_name, p.last_name
$$;
revoke all on function public.outsourcing_directory() from public, anon;
grant execute on function public.outsourcing_directory() to authenticated;

-- tell the provider when someone marks them hired or leaves a review
create function public.notify_outsourcing() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare who text;
begin
  if current_setting('flc.undoing', true) = 'on' then return new; end if;
  select coalesce(first_name || ' ' || last_name, 'Someone') into who from public.profiles where id = new.hirer_id;
  if tg_op = 'INSERT' then
    perform public.notify_user(new.provider_id, 'outsourcing', who || ' hired you', 'You were added to their hires in Outsourcing.', '/outsourcing');
  elsif new.rating is distinct from old.rating and new.rating is not null then
    perform public.notify_user(new.provider_id, 'outsourcing', who || ' left you a review', new.rating || ' of 5 stars' || coalesce(': ' || left(new.review, 100), ''), '/outsourcing');
  end if;
  return new;
end $$;
create trigger oh_notify after insert or update on public.outsourcing_hires for each row execute function public.notify_outsourcing();

-- ---------------------------------------------------------------- activity log covers these too
create function public.audit_tables() returns text[] language sql immutable as $$
  select array['calls', 'signup_allowlist', 'profiles', 'financing_options', 'resource_submissions', 'announcements', 'chats', 'chat_sections', 'payments', 'chat_posts', 'chat_comments', 'outsourcing_profiles', 'outsourcing_hires'] $$;
create or replace function public.audit_label(t text) returns text language sql immutable as $$
  select case t when 'calls' then 'call' when 'signup_allowlist' then 'invite' when 'profiles' then 'person' when 'financing_options' then 'financing option'
    when 'resource_submissions' then 'resource submission' when 'announcements' then 'announcement' when 'chats' then 'chat' when 'chat_sections' then 'chat section'
    when 'payments' then 'payment' when 'chat_posts' then 'post' when 'chat_comments' then 'reply' when 'outsourcing_profiles' then 'outsourcing listing'
    when 'outsourcing_hires' then 'outsourcing review' else t end $$;
create trigger zz_audit after insert or update or delete on public.outsourcing_profiles for each row execute function public.audit_row();
create trigger zz_audit after insert or update or delete on public.outsourcing_hires for each row execute function public.audit_row();

-- Undo one logged action. Only admins; not for entries already undone.
create or replace function public.undo_audit(p_id bigint) returns jsonb
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
  if tbl <> all (public.audit_tables()) then
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

-- the log needs a name for these rows; only admin removals of someone else's listing or review are logged
create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public, pg_temp
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
  if tg_table_name = 'outsourcing_hires' and tg_op <> 'DELETE' then return null; end if;
  if tg_table_name = 'outsourcing_profiles' and tg_op <> 'DELETE' then return null; end if;
  if tg_table_name = 'chat_comments' and (tg_op <> 'DELETE' or (o->>'author_id')::uuid = actor) then return null; end if;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into cols from jsonb_object_keys(n) k where o->k is distinct from n->k and k not in ('updated_at');
    if cols is null then return null; end if;
  end if;
  act := lower(tg_op);
  nm := coalesce(r->>'title', r->>'email', r->>'username', r->>'name', r->>'first_name', r->>'headline', left(r->>'body', 40),
                 case when tg_table_name = 'payments' then '$' || ((r->>'amount_cents')::numeric / 100)::text end, coalesce(r->>'id', r->>'member_id'));
  insert into public.audit_log (actor_id, action, table_name, summary, before_row, after_row, changed_cols)
  values (actor, act, tg_table_name,
          case act when 'insert' then 'Added ' when 'delete' then 'Removed ' else 'Changed ' end || public.audit_label(tg_table_name) || ' "' || nm || '"'
            || case when cols is not null then ' (' || array_to_string(cols, ', ') || ')' else '' end,
          o, n, cols);
  return null;
end $$;

