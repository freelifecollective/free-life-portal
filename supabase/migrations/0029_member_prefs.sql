-- Personal preferences. For now: which kind of daily quote shows on Home.
create table public.member_prefs (
  member_id   uuid primary key references public.profiles (id) on delete cascade,
  quote_style text not null default 'general' check (quote_style in ('general', 'faith', 'spiritual')),
  updated_at  timestamptz not null default now()
);
alter table public.member_prefs enable row level security;
create policy mprefs_read on public.member_prefs for select to authenticated using (member_id = auth.uid());
create policy mprefs_insert on public.member_prefs for insert to authenticated with check (member_id = auth.uid());
create policy mprefs_update on public.member_prefs for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create trigger member_prefs_touch before update on public.member_prefs for each row execute function public.touch_updated_at();
