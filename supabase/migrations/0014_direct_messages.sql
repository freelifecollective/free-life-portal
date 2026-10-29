-- Direct messages with read receipts. Reading is explicit: opening a conversation marks it read, peeking never does.

create table public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);
create index dm_recipient_idx on public.direct_messages (recipient_id, created_at desc);
create index dm_sender_idx on public.direct_messages (sender_id, created_at desc);
create index dm_unread_idx on public.direct_messages (recipient_id) where read_at is null;

-- who may be written to: any finished profile, except that a lead cannot message another lead
create function public.can_message(p_recipient uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles r where r.id = p_recipient and r.onboarded_at is not null and r.id <> auth.uid()
                 and (public.app_current_role() <> 'lead' or r.role <> 'lead'))
$$;
revoke all on function public.can_message(uuid) from public, anon;
grant execute on function public.can_message(uuid) to authenticated;

alter table public.direct_messages enable row level security;
create policy dm_read on public.direct_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy dm_send on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and read_at is null and public.can_message(recipient_id));
create policy dm_mark_read on public.direct_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy dm_delete_own on public.direct_messages for delete to authenticated using (sender_id = auth.uid());

-- only the read marker may change
create function public.dm_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('authenticated', 'anon') and (new.sender_id is distinct from old.sender_id or new.recipient_id is distinct from old.recipient_id
       or new.body is distinct from old.body or new.created_at is distinct from old.created_at or (old.read_at is not null and new.read_at is distinct from old.read_at)) then
    raise exception 'only the read marker can change, once' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger dm_guard before update on public.direct_messages for each row execute function public.dm_guard();

-- Opening a conversation: everything the other person sent you becomes Read now.
create function public.mark_conversation_read(p_other uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  update public.direct_messages set read_at = now() where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- a new message notifies the recipient
create function public.notify_direct_message() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare s record;
begin
  select first_name, last_name, username into s from public.profiles where id = new.sender_id;
  perform public.notify_user(new.recipient_id, 'direct_message', coalesce(s.first_name || ' ' || s.last_name, 'Someone') || ' sent you a message',
    left(new.body, 120), '/messages/' || coalesce(s.username::text, ''));
  return new;
end $$;
create trigger dm_notify after insert on public.direct_messages for each row execute function public.notify_direct_message();

alter publication supabase_realtime add table public.direct_messages;

-- people the signed-in person is allowed to message (for the "New message" picker)
create function public.messageable_people() returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, is_admin boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, p.role = 'admin'
  from public.profiles p where public.can_message(p.id) and p.username is not null
  order by p.first_name, p.last_name
$$;
revoke all on function public.messageable_people() from public, anon;
grant execute on function public.messageable_people() to authenticated;
