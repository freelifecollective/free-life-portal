-- What a call closer shows on their profile: calls taken, how long they have been taking calls, close rate and prices.
-- For now an admin fills these in (they will be worked out automatically once bookings come in on their own).
create table public.call_closer_details (
  member_id          uuid primary key references public.profiles (id) on delete cascade,
  calls_taken        integer not null default 0 check (calls_taken >= 0),
  closer_since       date,
  close_rate         numeric(5, 2) check (close_rate is null or close_rate between 0 and 100),
  price_per_call_cents integer check (price_per_call_cents is null or price_per_call_cents between 0 and 10000000),
  price_per_sale_cents integer check (price_per_sale_cents is null or price_per_sale_cents between 0 and 10000000),
  updated_at         timestamptz not null default now()
);
alter table public.call_closer_details enable row level security;
-- (a helper, because affiliates cannot read other people's profile rows directly)
create function public.is_call_closer(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = p_id and p.call_closer and p.removed_at is null) $$;
revoke all on function public.is_call_closer(uuid) from public, anon;
grant execute on function public.is_call_closer(uuid) to authenticated;
-- affiliates can read the details of people who are call closers; admins can read and change everything
create policy ccd_read on public.call_closer_details for select to authenticated
  using (public.is_admin() or (public.can_see('member') and public.is_call_closer(member_id)));
create policy ccd_admin on public.call_closer_details for all to authenticated using (public.is_admin()) with check (public.is_admin());
