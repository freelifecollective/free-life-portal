-- Phase 89: a push for every new message in every chat and private group, and a Telegram-style mute for each chat.
-- Safe to run more than once.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing', 'accountability', 'recording', 'task', 'chat_message'));

-- who muted what, and until when (null = forever)
create table if not exists public.chat_mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind    text not null check (kind in ('chat', 'group')),
  target  uuid not null,
  until   timestamptz,
  primary key (user_id, kind, target)
);
alter table public.chat_mutes enable row level security;
drop policy if exists chat_mutes_own on public.chat_mutes;
create policy chat_mutes_own on public.chat_mutes for select to authenticated using (user_id = auth.uid());

-- mute (p_until null = forever) or unmute (p_unmute true)
create or replace function public.set_chat_mute(p_kind text, p_target uuid, p_until timestamptz, p_unmute boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_kind not in ('chat', 'group') then raise exception 'bad kind' using errcode = '22023'; end if;
  if p_unmute then
    delete from public.chat_mutes where user_id = auth.uid() and kind = p_kind and target = p_target;
  else
    if p_until is not null and p_until <= now() then raise exception 'time is in the past' using errcode = '22023'; end if;
    insert into public.chat_mutes (user_id, kind, target, until) values (auth.uid(), p_kind, p_target, p_until)
      on conflict (user_id, kind, target) do update set until = excluded.until;
  end if;
end $$;
revoke all on function public.set_chat_mute(text, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.set_chat_mute(text, uuid, timestamptz, boolean) to authenticated;

create or replace function public.is_muted(p_user uuid, p_kind text, p_target uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.chat_mutes m where m.user_id = p_user and m.kind = p_kind and m.target = p_target and (m.until is null or m.until > now())) $$;
revoke all on function public.is_muted(uuid, text, uuid) from public, anon, authenticated;

-- only people who can receive a push get a row (nobody else would see it); the rows are read at once and deleted after sending
create or replace function public.notify_chat_message() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare c record; who text;
begin
  select ch.id, ch.slug, ch.name, ch.min_role into c from public.chats ch where ch.id = new.chat_id;
  if c.id is null or c.slug = 'important-updates' then return new; end if;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into who from public.profiles where id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, url, read_at)
    select p.id, 'chat_message', c.name, coalesce(who, 'Someone') || ': ' || left(new.body, 120), '/chats/' || c.slug, now()
      from public.profiles p
     where p.onboarded_at is not null and p.id is distinct from new.author_id
       and public.role_rank(p.role) >= public.role_rank(c.min_role)
       and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
       and not public.is_muted(p.id, 'chat', c.id);
  return new;
exception when others then return new;  -- a push problem must never stop a post from saving
end $$;
drop trigger if exists chat_posts_push on public.chat_posts;
create trigger chat_posts_push after insert on public.chat_posts for each row execute function public.notify_chat_message();

create or replace function public.notify_group_message() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare g text; who text;
begin
  select name into g from public.group_chats where id = new.group_id;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into who from public.profiles where id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, url, read_at)
    select gm.user_id, 'chat_message', coalesce(g, 'Private group'), coalesce(who, 'Someone') || ': ' || left(new.body, 120), '/groups/' || new.group_id, now()
      from public.group_members gm
     where gm.group_id = new.group_id and gm.user_id is distinct from new.author_id
       and exists (select 1 from public.push_subscriptions s where s.user_id = gm.user_id)
       and not public.is_muted(gm.user_id, 'group', new.group_id);
  return new;
exception when others then return new;
end $$;
drop trigger if exists group_messages_push on public.group_messages;
create trigger group_messages_push after insert on public.group_messages for each row execute function public.notify_group_message();

notify pgrst, 'reload schema';
