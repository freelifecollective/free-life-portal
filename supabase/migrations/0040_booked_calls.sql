-- Calls booked: upcoming calls an affiliate has with their leads, and the call closer taking each one (if they hired one).
create table public.booked_calls (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles (id) on delete cascade,
  lead_name  text not null check (char_length(btrim(lead_name)) between 1 and 80),
  starts_at  timestamptz not null,
  closer_id  uuid references public.profiles (id) on delete set null,
  note       text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index booked_calls_member_idx on public.booked_calls (member_id, starts_at);
alter table public.booked_calls enable row level security;
-- the affiliate sees their own, the closer sees the ones assigned to them, admins see all
create policy bc_read on public.booked_calls for select to authenticated using (member_id = auth.uid() or closer_id = auth.uid() or public.is_admin());
create policy bc_insert on public.booked_calls for insert to authenticated with check (member_id = auth.uid() and public.can_see('member'));
create policy bc_update on public.booked_calls for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy bc_delete on public.booked_calls for delete to authenticated using (member_id = auth.uid() or public.is_admin());
