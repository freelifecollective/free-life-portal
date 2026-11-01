-- Phase 107: file attachments, forwarding, voice notes in replies, and voice notes capped at 15 minutes. Safe to run more than once.

-- voice notes: 15 minutes at most
alter table public.chat_comments add column if not exists audio_url text;
alter table public.chat_comments add column if not exists audio_secs smallint;

-- high quality recordings are bigger: allow up to 50 MB per voice note file
update storage.buckets set file_size_limit = 52428800 where id = 'voice-notes';

-- attachments (pictures, PDFs, documents) and "forwarded from"
alter table public.chat_posts add column if not exists attach_url text;
alter table public.chat_posts add column if not exists attach_name text;
alter table public.chat_posts add column if not exists attach_type text;
alter table public.chat_posts add column if not exists attach_size integer;
alter table public.chat_posts add column if not exists forwarded_from text;
alter table public.group_messages add column if not exists attach_url text;
alter table public.group_messages add column if not exists attach_name text;
alter table public.group_messages add column if not exists attach_type text;
alter table public.group_messages add column if not exists attach_size integer;
alter table public.group_messages add column if not exists forwarded_from text;
alter table public.direct_messages add column if not exists attach_url text;
alter table public.direct_messages add column if not exists attach_name text;
alter table public.direct_messages add column if not exists attach_type text;
alter table public.direct_messages add column if not exists attach_size integer;
alter table public.direct_messages add column if not exists forwarded_from text;

do $$ declare t text; begin
  foreach t in array array['chat_posts', 'group_messages', 'direct_messages', 'chat_comments'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_audio_check');
    execute format($f$alter table public.%I add constraint %I check (audio_url is null or (char_length(audio_url) <= 1000 and audio_url ~ '^https://[a-z0-9.-]+/storage/v1/object/public/voice-notes/' and audio_secs between 1 and 900))$f$, t, t || '_audio_check');
  end loop;
  foreach t in array array['chat_posts', 'group_messages', 'direct_messages'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_attach_check');
    execute format($f$alter table public.%I add constraint %I check (attach_url is null or (char_length(attach_url) <= 1000 and attach_url ~ '^https://[a-z0-9.-]+/storage/v1/object/public/(chat-files|dm-pictures)/' and char_length(coalesce(attach_name, '')) between 1 and 160 and attach_type is not null and char_length(attach_type) <= 120 and attach_size between 1 and 26214400))$f$, t, t || '_attach_check');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_fwd_check');
    execute format($f$alter table public.%I add constraint %I check (forwarded_from is null or char_length(forwarded_from) <= 120)$f$, t, t || '_fwd_check');
  end loop;
end $$;

alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages add constraint direct_messages_body_check
  check (char_length(body) <= 4000 and (image_url is not null or audio_url is not null or attach_url is not null or char_length(btrim(body)) >= 1));

create or replace function public.dm_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('authenticated', 'anon') and (new.sender_id is distinct from old.sender_id or new.recipient_id is distinct from old.recipient_id
       or new.body is distinct from old.body or new.image_url is distinct from old.image_url or new.audio_url is distinct from old.audio_url
       or new.attach_url is distinct from old.attach_url or new.created_at is distinct from old.created_at
       or (old.read_at is not null and new.read_at is distinct from old.read_at)) then
    raise exception 'only the read marker can change, once' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.notify_direct_message() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare s record;
begin
  select first_name, last_name, username into s from public.profiles where id = new.sender_id;
  perform public.notify_user(new.recipient_id, 'direct_message', coalesce(s.first_name || ' ' || s.last_name, 'Someone') || ' sent you a message',
    case when new.audio_url is not null then '🎤 Sent a voice note' when new.attach_url is not null then '📎 Sent a file' when btrim(new.body) = '' then '📷 Sent a picture' else left(new.body, 120) end,
    '/messages/' || coalesce(s.username::text, ''));
  return new;
end $$;

-- only plain text messages can be edited
create or replace function public.edit_group_message(p_id uuid, p_body text) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'bad message' using errcode = '22023'; end if;
  update public.group_messages set body = btrim(p_body), edited_at = now()
   where id = p_id and author_id = auth.uid() and image_url is null and audio_url is null and attach_url is null and public.is_group_member(group_id);
  get diagnostics n = row_count;
  return n = 1;
end $$;
create or replace function public.edit_direct_message(p_id uuid, p_body text) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'bad message' using errcode = '22023'; end if;
  update public.direct_messages set body = btrim(p_body), edited_at = now()
   where id = p_id and sender_id = auth.uid() and image_url is null and audio_url is null and attach_url is null;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- file storage: signed-in people add to their own folder; anyone with the (unguessable) link can open it
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists cf_read on storage.objects;
create policy cf_read on storage.objects for select using (bucket_id = 'chat-files');
drop policy if exists cf_insert on storage.objects;
create policy cf_insert on storage.objects for insert to authenticated with check (bucket_id = 'chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cf_delete on storage.objects;
create policy cf_delete on storage.objects for delete to authenticated using (bucket_id = 'chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
notify pgrst, 'reload schema';
