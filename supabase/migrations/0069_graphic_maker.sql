-- Graphic maker: admins upload template pictures and choose where a member's photo, name and link go. Members pick one and download it.
create table if not exists public.graphic_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  image_url  text not null check (char_length(image_url) between 10 and 500),
  layout     jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object' and pg_column_size(layout) < 4000),
  published  boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.graphic_templates enable row level security;
drop policy if exists gt_read on public.graphic_templates;
create policy gt_read on public.graphic_templates for select to authenticated using (public.is_admin() or (published and public.can_see('member')));
drop policy if exists gt_admin on public.graphic_templates;
create policy gt_admin on public.graphic_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
notify pgrst, 'reload schema';
