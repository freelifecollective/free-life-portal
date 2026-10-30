-- Pictures and GIFs in direct messages. A message can be text, a picture, or both.
alter table public.direct_messages add column if not exists image_url text;
alter table public.direct_messages drop constraint if exists direct_messages_image_url_check;
alter table public.direct_messages add constraint direct_messages_image_url_check
  check (image_url is null or (char_length(image_url) <= 1000 and image_url ~ '^https://(media[0-9]*\.giphy\.com/|[a-z0-9.-]+/storage/v1/object/public/dm-pictures/)'));
alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages add constraint direct_messages_body_check
  check (char_length(body) <= 4000 and (image_url is not null or char_length(btrim(body)) >= 1));

-- the picture, like the words, cannot be changed after sending (only the read marker may change)
create or replace function public.dm_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('authenticated', 'anon') and (new.sender_id is distinct from old.sender_id or new.recipient_id is distinct from old.recipient_id
       or new.body is distinct from old.body or new.image_url is distinct from old.image_url or new.created_at is distinct from old.created_at
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
    case when btrim(new.body) = '' then '📷 Sent a picture' else left(new.body, 120) end, '/messages/' || coalesce(s.username::text, ''));
  return new;
end $$;

-- picture storage: anyone signed in can add to their own folder; anyone with the link can look (the names cannot be guessed)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-pictures', 'dm-pictures', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists dmp_read on storage.objects;
create policy dmp_read on storage.objects for select using (bucket_id = 'dm-pictures');
drop policy if exists dmp_insert on storage.objects;
create policy dmp_insert on storage.objects for insert to authenticated with check (bucket_id = 'dm-pictures' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists dmp_delete on storage.objects;
create policy dmp_delete on storage.objects for delete to authenticated using (bucket_id = 'dm-pictures' and (storage.foldername(name))[1] = auth.uid()::text);
