-- Chat subtitles (different for leads and affiliates) and resource submissions with admin review.

alter table public.chats add column description_lead text;  -- shown to leads instead of `description` when set

update public.chats set description = 'Welcome your leads here and congratulate your newest business partners on affiliating',
  description_lead = 'Welcome to the family, feel free to introduce yourself and ask any questions you may have.' where slug = 'welcome-discussion';
update public.chats set description = 'Share your business, personal, and water wins here. Be mindful of using the word ''lead/s'' as they are in this chat as well.',
  description_lead = 'Share a win, big or small.' where slug = 'wins';
update public.chats set description = 'Not sure where to ask your question? Post it here!' where slug = 'qa-discussion';
update public.chats set description = 'Ask any questions you have about ads, ads graphics, Meta, the Meta Business Suite, forms, etc.' where slug = 'ads';
update public.chats set description = 'Ask any questions you have about in-person sales, water demos, business cards/pamphlets, etc.' where slug = 'in-person-sales';
update public.chats set description = 'Need help with onboarding or have any questions about the business launch course? Ask them here.' where slug = 'onboarding';
update public.chats set description = 'Ask any questions here related to the products, pre-filtration, installation, taps etc.' where slug = 'product-questions';
update public.chats set description = 'Request a new resource, ask where to find one, or share one of your own to be added to the community.' where slug = 'resources';

-- ---------------------------------------------------------------- resource submissions
create table public.resource_submissions (
  id           uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  description  text not null check (char_length(btrim(description)) between 1 and 2000),
  links        text[] not null default '{}' check (cardinality(links) <= 5),
  files        jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 5),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  review_note  text check (review_note is null or char_length(review_note) <= 500)
);
create index resource_submissions_status_idx on public.resource_submissions (status, created_at);

alter table public.resource_submissions enable row level security;
create policy rs_insert_own on public.resource_submissions for insert to authenticated
  with check (submitter_id = auth.uid() and status = 'pending' and public.can_see('member'));
create policy rs_read_own on public.resource_submissions for select to authenticated using (submitter_id = auth.uid());
create policy rs_read_admin on public.resource_submissions for select to authenticated using (public.is_admin());
create policy rs_review on public.resource_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rs_delete_admin on public.resource_submissions for delete to authenticated using (public.is_admin());

-- links must be https
create function public.rs_check_links() returns trigger language plpgsql as $$
begin
  if exists (select 1 from unnest(new.links) l where l !~ '^https://\S+$' or char_length(l) > 500) then
    raise exception 'links must start with https://' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger rs_check_links before insert or update on public.resource_submissions for each row execute function public.rs_check_links();

-- private bucket for the uploaded documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resource-submissions', 'resource-submissions', false, 26214400, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy rs_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resource-submissions' and (storage.foldername(name))[1] = auth.uid()::text and public.can_see('member'));
create policy rs_files_read on storage.objects for select to authenticated
  using (bucket_id = 'resource-submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy rs_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resource-submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
