-- Phase 90: unread numbers on every chat, "seen by" with times, and GIFs in conversations.
-- Safe to run more than once.

alter table public.chat_posts add column if not exists image_url text;
alter table public.group_messages add column if not exists image_url text;
alter table public.chat_posts drop constraint if exists chat_posts_image_url_check;
alter table public.chat_posts add constraint chat_posts_image_url_check check (image_url is null or image_url ~ '^https://media[0-9]*\.giphy\.com/');
alter table public.group_messages drop constraint if exists group_messages_image_url_check;
alter table public.group_messages add constraint group_messages_image_url_check check (image_url is null or image_url ~ '^https://media[0-9]*\.giphy\.com/');

-- where each person has read up to in each community chat
create table if not exists public.chat_reads (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  chat_id      uuid not null references public.chats (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);
alter table public.chat_reads enable row level security;   -- no policies: only the functions below touch it

-- every time someone catches up, kept so we can say when a particular message was seen
create table if not exists public.chat_read_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind    text not null check (kind in ('chat', 'group')),
  target  uuid not null,
  up_to   timestamptz not null,
  at      timestamptz not null default now()
);
create index if not exists chat_read_log_target on public.chat_read_log (kind, target, up_to);
alter table public.chat_read_log enable row level security;

-- everyone starts caught up, so nobody opens the portal to hundreds of old "unread" messages
insert into public.chat_reads (user_id, chat_id, last_read_at) select p.id, c.id, now() from public.profiles p cross join public.chats c on conflict do nothing;

create or replace function public.log_read(p_kind text, p_target uuid, p_newest timestamptz) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_newest is null then return; end if;
  if p_newest > coalesce((select max(l.up_to) from public.chat_read_log l where l.user_id = auth.uid() and l.kind = p_kind and l.target = p_target), '-infinity') then
    insert into public.chat_read_log (user_id, kind, target, up_to) values (auth.uid(), p_kind, p_target, p_newest);
  end if;
end $$;
revoke all on function public.log_read(text, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.mark_chat_read(p_chat uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.app_role;
begin
  if auth.uid() is null then return; end if;
  select p.role into r from public.profiles p where p.id = auth.uid();
  if not exists (select 1 from public.chats c where c.id = p_chat and public.role_rank(r) >= public.role_rank(c.min_role)) then return; end if;
  insert into public.chat_reads (user_id, chat_id, last_read_at) values (auth.uid(), p_chat, now())
    on conflict (user_id, chat_id) do update set last_read_at = now();
  perform public.log_read('chat', p_chat, (select max(created_at) from public.chat_posts where chat_id = p_chat));
end $$;
revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

create or replace function public.mark_group_read(p_group uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid();
  if found then perform public.log_read('group', p_group, (select max(created_at) from public.group_messages where group_id = p_group)); end if;
end $$;

-- how many messages from other people I have not read, for each chat I can open
create or replace function public.chat_unreads() returns table (chat_id uuid, unread integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id,
         (select count(*)::int from public.chat_posts x
           where x.chat_id = c.id and x.author_id is distinct from auth.uid()
             and x.created_at > coalesce(cr.last_read_at, me.created_at))
    from public.profiles me
    join public.chats c on public.role_rank(me.role) >= public.role_rank(c.min_role)
    left join public.chat_reads cr on cr.chat_id = c.id and cr.user_id = me.id
   where me.id = auth.uid()
$$;
revoke all on function public.chat_unreads() from public, anon;
grant execute on function public.chat_unreads() to authenticated;

-- who has seen messages in a chat or group since a given time, and when (never includes me)
create or replace function public.read_receipts(p_kind text, p_target uuid, p_since timestamptz)
returns table (user_id uuid, up_to timestamptz, at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return; end if;
  if p_kind = 'group' then
    if not public.is_group_member(p_target) then return; end if;
  elsif p_kind = 'chat' then
    if not exists (select 1 from public.chats c join public.profiles p on p.id = auth.uid() where c.id = p_target and public.role_rank(p.role) >= public.role_rank(c.min_role)) then return; end if;
  else return; end if;
  return query select l.user_id, l.up_to, l.at from public.chat_read_log l
     where l.kind = p_kind and l.target = p_target and l.up_to >= p_since and l.user_id <> auth.uid()
     order by l.up_to limit 6000;
end $$;
revoke all on function public.read_receipts(text, uuid, timestamptz) from public, anon;
grant execute on function public.read_receipts(text, uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
