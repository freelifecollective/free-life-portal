-- Payment history and receipts. Rows are written by admins (or later by the payment processor's webhook); members only read their own.
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   bigint generated always as identity,
  member_id    uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  currency     text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  description  text not null default 'Monthly membership' check (char_length(description) between 1 and 200),
  status       text not null default 'paid' check (status in ('paid', 'refunded')),
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index payments_member_idx on public.payments (member_id, paid_at desc);

alter table public.payments enable row level security;
create policy payments_read_own on public.payments for select to authenticated using (member_id = auth.uid());
create policy payments_admin_all on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
