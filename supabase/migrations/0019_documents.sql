-- Documents: an internal drive with folders inside folders, per-item visibility, and view-only documents.
-- Paying affiliates (members and admins) can see everything. Leads and Lacey's downline only see what is switched on for them,
-- and only if every folder above it is switched on too.

create table public.doc_folders (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.doc_folders (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  for_leads   boolean not null default false,
  for_downline boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index doc_folders_parent_idx on public.doc_folders (parent_id);
-- no two folders with the same name in the same place
create unique index doc_folders_name_unique on public.doc_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

create table public.doc_files (
  id           uuid primary key default gen_random_uuid(),
  folder_id    uuid references public.doc_folders (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  storage_path text not null unique,
  mime         text not null default 'application/octet-stream',
  size_bytes   bigint not null default 0 check (size_bytes >= 0),
  downloadable boolean not null default true,
  for_leads    boolean not null default false,
  for_downline boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  -- view-only only works for things a browser can show itself
  check (downloadable or mime ~ '^(application/pdf|image/|video/|audio/|text/plain)')
);
create index doc_files_folder_idx on public.doc_files (folder_id);

-- Is this folder (and every folder above it) switched on for the person asking?
create function public.doc_folder_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  with recursive up as (
    select id, parent_id, for_leads, 1 as depth from public.doc_folders where id = p_id
    union all
    select f.id, f.parent_id, f.for_leads, up.depth + 1 from public.doc_folders f join up on f.id = up.parent_id where up.depth < 25
  )
  select case
    when auth.uid() is null then false
    when p_id is null then true
    when public.can_see('member') then exists (select 1 from up)
    when public.app_current_role() = 'lead' then coalesce((select bool_and(for_leads) from up), false)
    else false end
$$;
create function public.doc_file_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select case when public.can_see('member') then true
                               when public.app_current_role() = 'lead' then f.for_leads and public.doc_folder_visible(f.folder_id)
                               else false end
                   from public.doc_files f where f.id = p_id), false)
$$;
revoke all on function public.doc_folder_visible(uuid), public.doc_file_visible(uuid) from public, anon;
grant execute on function public.doc_folder_visible(uuid), public.doc_file_visible(uuid) to authenticated;

alter table public.doc_folders enable row level security;
alter table public.doc_files enable row level security;
create policy df_read on public.doc_folders for select to authenticated using (public.doc_folder_visible(id));
create policy df_admin on public.doc_folders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy dfi_read on public.doc_files for select to authenticated using (public.doc_file_visible(id));
create policy dfi_admin on public.doc_files for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- a folder cannot be moved inside itself, and folders stay a sensible depth
create function public.doc_folders_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare d integer;
begin
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    with recursive up as (
      select id, parent_id, 1 as depth from public.doc_folders where id = new.parent_id
      union all select f.id, f.parent_id, up.depth + 1 from public.doc_folders f join up on f.id = up.parent_id where up.depth < 30
    ) select max(depth) into d from up;
    if tg_op = 'UPDATE' and exists (
      with recursive up as (
        select id, parent_id from public.doc_folders where id = new.parent_id
        union all select f.id, f.parent_id from public.doc_folders f join up on f.id = up.parent_id
      ) select 1 from up where id = new.id) then
      raise exception 'a folder cannot go inside itself' using errcode = '23514';
    end if;
    if coalesce(d, 0) >= 12 then raise exception 'folders are nested too deep' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
create trigger doc_folders_guard before insert or update on public.doc_folders for each row execute function public.doc_folders_guard();

-- switch a folder on or off for leads / Lacey's downline, optionally for everything inside it
create function public.set_doc_visibility(p_folder uuid, p_leads boolean, p_downline boolean, p_cascade boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'only admins' using errcode = '42501'; end if;
  if p_cascade then
    with recursive down as (
      select id from public.doc_folders where id = p_folder
      union all select f.id from public.doc_folders f join down on f.parent_id = down.id
    ) , upd as (
      update public.doc_folders f set for_leads = p_leads, for_downline = p_downline where f.id in (select id from down) returning f.id
    )
    update public.doc_files x set for_leads = p_leads, for_downline = p_downline where x.folder_id in (select id from down);
  else
    update public.doc_folders set for_leads = p_leads, for_downline = p_downline where id = p_folder;
  end if;
end $$;
revoke all on function public.set_doc_visibility(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_doc_visibility(uuid, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------- the files themselves
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create function public.can_read_doc_object(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.doc_files f where f.storage_path = p_name and public.doc_file_visible(f.id)) $$;
revoke all on function public.can_read_doc_object(text) from public, anon;
grant execute on function public.can_read_doc_object(text) to authenticated;

create policy docs_read on storage.objects for select to authenticated using (bucket_id = 'documents' and public.can_read_doc_object(name));
create policy docs_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.is_admin());
create policy docs_admin_update on storage.objects for update to authenticated using (bucket_id = 'documents' and public.is_admin()) with check (bucket_id = 'documents' and public.is_admin());
create policy docs_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.is_admin());

-- ---------------------------------------------------------------- activity log
create or replace function public.audit_tables() returns text[] language sql immutable as $$
  select array['calls', 'signup_allowlist', 'profiles', 'financing_options', 'resource_submissions', 'announcements', 'chats', 'chat_sections', 'payments', 'chat_posts', 'chat_comments', 'outsourcing_profiles', 'outsourcing_hires', 'doc_folders', 'doc_files'] $$;
create or replace function public.audit_label(t text) returns text language sql immutable as $$
  select case t when 'calls' then 'call' when 'signup_allowlist' then 'invite' when 'profiles' then 'person' when 'financing_options' then 'financing option'
    when 'resource_submissions' then 'resource submission' when 'announcements' then 'announcement' when 'chats' then 'chat' when 'chat_sections' then 'chat section'
    when 'payments' then 'payment' when 'chat_posts' then 'post' when 'chat_comments' then 'reply' when 'outsourcing_profiles' then 'outsourcing listing'
    when 'outsourcing_hires' then 'outsourcing review' when 'doc_folders' then 'folder' when 'doc_files' then 'document' else t end $$;
create trigger zz_audit after insert or update or delete on public.doc_folders for each row execute function public.audit_row();
create trigger zz_audit after update or delete on public.doc_files for each row execute function public.audit_row();
