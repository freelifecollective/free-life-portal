-- The Resources section: books, pictures and videos, product information and Canva templates, kept by admins and seen by affiliates.
create table public.resource_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('books', 'media', 'products', 'canva')),
  title       text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 600),
  url         text not null check (url ~ '^https://\S+$' and char_length(url) <= 1000),
  image_url   text check (image_url is null or (image_url ~ '^https://\S+$' and char_length(image_url) <= 1000)),
  created_at  timestamptz not null default now()
);
create index resource_items_category on public.resource_items (category, created_at desc);
alter table public.resource_items enable row level security;
create policy ri_read on public.resource_items for select to authenticated using (public.can_see('member'));
create policy ri_admin on public.resource_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
