-- Chats as ongoing conversations (like Telegram), replies that quote a message, and private group conversations.
alter table public.chats add column if not exists mode text not null default 'feed' check (mode in ('feed', 'conversation'));
update public.chats set mode = 'conversation' where slug <> 'important-updates' and not votes_on and posting = 'all';
alter table public.chat_posts add column if not exists reply_to uuid references public.chat_posts (id) on delete set null;

-- ---------------------------------------------------------------- private groups
create table if not exists public.group_chats (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id     uuid not null references public.group_chats (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);
create table if not exists public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.group_chats (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  reply_to   uuid references public.group_messages (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group on public.group_messages (group_id, created_at);
alter table public.group_chats enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = auth.uid()) $$;
create or replace function public.is_group_owner(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = auth.uid() and m.role = 'owner') $$;
revoke all on function public.is_group_member(uuid), public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_member(uuid), public.is_group_owner(uuid) to authenticated;

drop policy if exists gc_read on public.group_chats;
create policy gc_read on public.group_chats for select to authenticated using (public.is_group_member(id));
drop policy if exists gm_read on public.group_members;
create policy gm_read on public.group_members for select to authenticated using (public.is_group_member(group_id));
drop policy if exists gmsg_read on public.group_messages;
create policy gmsg_read on public.group_messages for select to authenticated using (public.is_group_member(group_id));
drop policy if exists gmsg_insert on public.group_messages;
create policy gmsg_insert on public.group_messages for insert to authenticated
  with check (author_id = auth.uid() and public.can_see('member') and public.is_group_member(group_id)
              and (group_messages.reply_to is null or exists (select 1 from public.group_messages r where r.id = group_messages.reply_to and r.group_id = group_messages.group_id)));
drop policy if exists gmsg_delete on public.group_messages;
create policy gmsg_delete on public.group_messages for delete to authenticated using (author_id = auth.uid() or public.is_group_owner(group_id) or public.is_admin());

-- an affiliate who can be put in a group
create or replace function public.group_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = p_user and p.role in ('member', 'admin') and p.onboarded_at is not null and p.removed_at is null) $$;

create or replace function public.create_group(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); gid uuid; u uuid; nm text; n integer := 0;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'give the group a name of up to 60 characters' using errcode = '22023'; end if;
  insert into public.group_chats (name, created_by) values (btrim(p_name), me) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, me, 'owner');
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = me;
  foreach u in array coalesce(p_members, '{}'::uuid[]) loop
    exit when n >= 49;
    if u <> me and public.group_eligible(u) then
      insert into public.group_members (group_id, user_id) values (gid, u) on conflict do nothing;
      perform public.notify_user(u, 'announcement', nm || ' added you to a group', btrim(p_name), '/groups/' || gid);
      n := n + 1;
    end if;
  end loop;
  return gid;
end $$;
revoke all on function public.create_group(text, uuid[]) from public, anon;
grant execute on function public.create_group(text, uuid[]) to authenticated;

create or replace function public.add_group_members(p_group uuid, p_members uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare u uuid; nm text; gname text;
begin
  if not public.is_group_owner(p_group) then raise exception 'only the group owner can add people' using errcode = '42501'; end if;
  select name into gname from public.group_chats where id = p_group;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = auth.uid();
  foreach u in array coalesce(p_members, '{}'::uuid[]) loop
    exit when (select count(*) from public.group_members where group_id = p_group) >= 50;
    if public.group_eligible(u) and not exists (select 1 from public.group_members where group_id = p_group and user_id = u) then
      insert into public.group_members (group_id, user_id) values (p_group, u);
      perform public.notify_user(u, 'announcement', nm || ' added you to a group', gname, '/groups/' || p_group);
    end if;
  end loop;
end $$;
revoke all on function public.add_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;

-- the owner removes someone, or anyone leaves. If the owner leaves, the longest-standing member takes over; an empty group is deleted.
create or replace function public.remove_group_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); was_owner boolean; next uuid;
begin
  if not public.is_group_member(p_group) then raise exception 'not in this group' using errcode = '42501'; end if;
  if p_user <> me and not public.is_group_owner(p_group) then raise exception 'only the group owner can remove people' using errcode = '42501'; end if;
  select (role = 'owner') into was_owner from public.group_members where group_id = p_group and user_id = p_user;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  if was_owner then
    select user_id into next from public.group_members where group_id = p_group order by joined_at limit 1;
    if next is null then delete from public.group_chats where id = p_group; else update public.group_members set role = 'owner' where group_id = p_group and user_id = next; end if;
  end if;
end $$;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

create or replace function public.rename_group(p_group uuid, p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_group_owner(p_group) then raise exception 'only the group owner can rename it' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'give the group a name of up to 60 characters' using errcode = '22023'; end if;
  update public.group_chats set name = btrim(p_name) where id = p_group;
end $$;
revoke all on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

create or replace function public.mark_group_read(p_group uuid) returns void
language sql security definer set search_path = public, pg_temp
as $$ update public.group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid() $$;
revoke all on function public.mark_group_read(uuid) from public, anon;
grant execute on function public.mark_group_read(uuid) to authenticated;

-- my groups, newest activity first, with the last message and how many I have not read
create or replace function public.group_overview()
returns table (id uuid, name text, members integer, unread integer, last_body text, last_author text, last_at timestamptz, is_owner boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select g.id, g.name, (select count(*)::int from public.group_members x where x.group_id = g.id),
         (select count(*)::int from public.group_messages m where m.group_id = g.id and m.created_at > gm.last_read_at and m.author_id is distinct from auth.uid()),
         lm.body, nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), coalesce(lm.created_at, g.created_at), gm.role = 'owner'
    from public.group_members gm
    join public.group_chats g on g.id = gm.group_id
    left join lateral (select m.body, m.created_at, m.author_id from public.group_messages m where m.group_id = g.id order by m.created_at desc limit 1) lm on true
    left join public.profiles p on p.id = lm.author_id
   where gm.user_id = auth.uid()
   order by coalesce(lm.created_at, g.created_at) desc
$$;
revoke all on function public.group_overview() from public, anon;
grant execute on function public.group_overview() to authenticated;

-- live updates
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.group_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.group_members; exception when duplicate_object then null; end;
  end if;
end $$;

insert into public.reserved_usernames (username) values ('groups'), ('group') on conflict do nothing;
notify pgrst, 'reload schema';
