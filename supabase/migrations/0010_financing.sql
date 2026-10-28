-- Financing Options: ways people can fund their business. Affiliates suggest, admins approve, approved ones show to everyone.
create table public.financing_options (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null check (char_length(btrim(description)) between 1 and 1500),
  link        text check (link is null or (link ~ '^https://\S+$' and char_length(link) <= 500)),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 500)
);
-- the same option cannot be listed twice (declined ones do not count, so it can be suggested again later)
create unique index financing_title_unique on public.financing_options (lower(btrim(title))) where status <> 'declined';
create index financing_status_idx on public.financing_options (status, created_at);

alter table public.financing_options enable row level security;
create policy fo_read_approved on public.financing_options for select to authenticated using (status = 'approved');
create policy fo_read_own on public.financing_options for select to authenticated using (submitted_by = auth.uid());
create policy fo_read_admin on public.financing_options for select to authenticated using (public.is_admin());
create policy fo_suggest on public.financing_options for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'pending' and public.can_see('member'));
create policy fo_admin_insert on public.financing_options for insert to authenticated with check (public.is_admin());
create policy fo_admin_update on public.financing_options for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy fo_admin_delete on public.financing_options for delete to authenticated using (public.is_admin());
