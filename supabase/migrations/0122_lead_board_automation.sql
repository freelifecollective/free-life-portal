-- Lead board, round two: more fields on a card, colour tags (made automatically when the right thing happens), and follow-up automation.
alter table public.lead_cards
  add column instagram text check (instagram is null or char_length(instagram) <= 60),
  add column facebook text check (facebook is null or char_length(facebook) <= 80),
  add column follow_up_on date,
  add column follow_up_days smallint not null default 3 check (follow_up_days between 1 and 365),
  add column resume_on date;
create index lead_cards_follow_idx on public.lead_cards (follow_up_on) where follow_up_on is not null;
create index lead_cards_resume_idx on public.lead_cards (resume_on) where resume_on is not null;

create table public.lead_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  system_key text check (system_key in ('instagram', 'facebook', 'ad', 'said_no', 'cant_find_ig', 'dms_not_seen', 'ghosted', 'in_portal')),
  created_at timestamptz not null default now()
);
create unique index lead_tags_system on public.lead_tags (user_id, system_key) where system_key is not null;
create table public.lead_card_tags (
  card_id uuid not null references public.lead_cards (id) on delete cascade,
  tag_id  uuid not null references public.lead_tags (id) on delete cascade,
  primary key (card_id, tag_id)
);
alter table public.lead_tags enable row level security;
create policy lead_tags_own on public.lead_tags for all to authenticated
  using (user_id = auth.uid() and public.can_see('member')) with check (user_id = auth.uid() and public.can_see('member'));
alter table public.lead_card_tags enable row level security;
create policy lead_card_tags_own on public.lead_card_tags for all to authenticated
  using (exists (select 1 from public.lead_cards c where c.id = card_id and c.user_id = auth.uid()) and public.can_see('member'))
  with check (exists (select 1 from public.lead_cards c where c.id = card_id and c.user_id = auth.uid()) and exists (select 1 from public.lead_tags t where t.id = tag_id and t.user_id = auth.uid()));

-- the eight starter tags (made once per person, the first time they are needed)
create or replace function public.ensure_system_tags(p_user uuid) returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.lead_tags (user_id, name, color, system_key) values
    (p_user, 'Instagram Lead', '#7B3FA0', 'instagram'), (p_user, 'Facebook Lead', '#2F80ED', 'facebook'), (p_user, 'Ad Lead', '#E8890C', 'ad'),
    (p_user, 'Said No', '#E0559A', 'said_no'), (p_user, 'Can''t Find IG', '#C2362B', 'cant_find_ig'), (p_user, 'DM''s Not Seen', '#D4A90A', 'dms_not_seen'),
    (p_user, 'Ghosted', '#6B7280', 'ghosted'), (p_user, 'In FLC Portal', '#2F7A56', 'in_portal')
  on conflict do nothing
$$;
revoke all on function public.ensure_system_tags(uuid) from public, anon, authenticated;
create or replace function public.ensure_lead_tags() returns void
language plpgsql security definer set search_path = public, pg_temp
as $$ begin if auth.uid() is not null and public.can_see('member') then perform public.ensure_system_tags(auth.uid()); end if; end $$;
revoke all on function public.ensure_lead_tags() from public, anon;
grant execute on function public.ensure_lead_tags() to authenticated;

create or replace function public.lead_add_tag(p_card uuid, p_key text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid; t uuid;
begin
  select user_id into uid from public.lead_cards where id = p_card;
  if uid is null then return; end if;
  perform public.ensure_system_tags(uid);
  select id into t from public.lead_tags where user_id = uid and system_key = p_key;
  if t is not null then insert into public.lead_card_tags (card_id, tag_id) values (p_card, t) on conflict do nothing; end if;
end $$;
revoke all on function public.lead_add_tag(uuid, text) from public, anon, authenticated;

-- move a card to the list of that name on its own board (a name pattern, like 'follow up due%'); false if the board has no such list
create or replace function public.lead_move_to(p_card uuid, p_pattern text) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare b uuid; l uuid; pos integer;
begin
  select x.board_id into b from public.lead_cards c join public.lead_lists x on x.id = c.list_id where c.id = p_card;
  if b is null then return false; end if;
  select id into l from public.lead_lists where board_id = b and name ilike p_pattern order by position limit 1;
  if l is null then return false; end if;
  select coalesce(max(position) + 1, 0) into pos from public.lead_cards where list_id = l;
  update public.lead_cards set list_id = l, position = pos where id = p_card and list_id <> l;
  return true;
end $$;
revoke all on function public.lead_move_to(uuid, text) from public, anon, authenticated;

-- BEFORE a card is saved: the countdown for "Circle Back in N Days" lists, and a follow-up date only stays while it is in Follow Up Set
create or replace function public.lead_cards_before() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare ln text; n integer;
begin
  if tg_op = 'INSERT' or new.list_id is distinct from old.list_id then
    select name into ln from public.lead_lists where id = new.list_id;
    n := (regexp_match(coalesce(ln, ''), 'circle back in (\d{1,3}) days', 'i'))[1]::integer;
    new.resume_on := case when n is not null then current_date + n else null end;
    if tg_op = 'UPDATE' and coalesce(ln, '') !~* '^follow up set' then new.follow_up_on := null; end if;
  end if;
  return new;
end $$;
create trigger lead_cards_before before insert or update on public.lead_cards for each row execute function public.lead_cards_before();

-- AFTER: the tags that go on by themselves
create or replace function public.lead_cards_after() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare ln text; bk text;
begin
  if nullif(btrim(coalesce(new.instagram, '')), '') is not null then perform public.lead_add_tag(new.id, 'instagram'); end if;
  if nullif(btrim(coalesce(new.facebook, '')), '') is not null then perform public.lead_add_tag(new.id, 'facebook'); end if;
  if tg_op = 'INSERT' or new.list_id is distinct from old.list_id then
    select x.name, b.kind into ln, bk from public.lead_lists x join public.lead_boards b on b.id = x.board_id where x.id = new.list_id;
    if bk = 'portal' then perform public.lead_add_tag(new.id, 'in_portal'); end if;
    if ln ilike 'said no%' then perform public.lead_add_tag(new.id, 'said_no'); end if;
    if ln ilike 'ghosted%' then perform public.lead_add_tag(new.id, 'ghosted'); end if;
  end if;
  return null;
end $$;
create trigger lead_cards_after after insert or update on public.lead_cards for each row execute function public.lead_cards_after();

-- A message sent inside the portal:
--  from the affiliate to a lead on their board: the lead is marked as followed up (Follow Up Set, due again in the card's number of days, 3 unless changed);
--  from the lead to the affiliate saying they are not interested: the card goes to Said No/Not Interested.
create or replace function public.lead_card_on_message() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c record; sender_email text; recipient_email text; moved boolean;
begin
  select email::text into sender_email from public.profiles where id = new.sender_id;
  select email::text into recipient_email from public.profiles where id = new.recipient_id;
  -- affiliate -> lead
  if recipient_email is not null then
    for c in select lc.id, lc.follow_up_days, x.name as list_name from public.lead_cards lc join public.lead_lists x on x.id = lc.list_id
              where lc.user_id = new.sender_id and lc.affiliated_at is null and lower(lc.email) = lower(recipient_email) loop
      if c.list_name ilike 'said no%' then continue; end if;
      moved := public.lead_move_to(c.id, 'follow up set%');
      if moved or c.list_name ilike 'follow up set%' then
        update public.lead_cards set follow_up_on = current_date + c.follow_up_days where id = c.id;
      end if;
    end loop;
  end if;
  -- lead -> affiliate
  if sender_email is not null and new.body ~* '(not\s+interested|no[,.!]?\s+thanks|no[,.!]?\s+thank\s+you|not\s+for\s+me)' then
    for c in select lc.id from public.lead_cards lc where lc.user_id = new.recipient_id and lc.affiliated_at is null and lower(lc.email) = lower(sender_email) loop
      perform public.lead_move_to(c.id, 'said no%');
      perform public.lead_add_tag(c.id, 'said_no');
    end loop;
  end if;
  return null;
end $$;
create trigger lead_card_on_message after insert on public.direct_messages for each row execute function public.lead_card_on_message();

-- Every hour: cards whose countdown ended, or whose follow-up date has come, move to Follow Up Due (and the person gets a nudge).
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing', 'accountability', 'recording', 'task', 'chat_message', 'quote_followup', 'lead_followup'));

create or replace function public.queue_lead_followups() returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; c record;
begin
  for c in
    select lc.id, lc.user_id, lc.name, lc.resume_on, lc.follow_up_on, x.name as list_name
      from public.lead_cards lc join public.lead_lists x on x.id = lc.list_id
      join public.profiles p on p.id = lc.user_id and p.removed_at is null
     where lc.affiliated_at is null
       and ((lc.resume_on is not null and lc.resume_on <= current_date) or (lc.follow_up_on is not null and lc.follow_up_on <= current_date and x.name ilike 'follow up set%'))
  loop
    if public.lead_move_to(c.id, 'follow up due%') then
      update public.lead_cards set resume_on = null, follow_up_on = null where id = c.id;
      perform public.notify_user(c.user_id, 'lead_followup', 'Follow up with ' || c.name || ' is due', 'Open Lead Tracking to see who is waiting for you.', '/tracking/leads');
      n := n + 1;
    else
      update public.lead_cards set resume_on = null, follow_up_on = null where id = c.id;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.queue_lead_followups() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('flc-lead-followups', '17 * * * *', 'select public.queue_lead_followups()');
  end if;
exception when others then
  raise notice 'pg_cron could not be set up: %', sqlerrm;
end $$;
