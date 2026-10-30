-- Call closer reviews, a count of FLC members who booked them, and a calls-taken figure that counts up on its own.

-- when the typed "calls taken" figure was last set; calls booked with this closer since then are added automatically
alter table public.call_closer_details add column if not exists counted_from timestamptz;

create table public.closer_reviews (
  id          uuid primary key default gen_random_uuid(),
  closer_id   uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  review      text check (review is null or char_length(review) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (closer_id, reviewer_id),
  check (closer_id <> reviewer_id)
);
alter table public.closer_reviews enable row level security;
create policy cr_read on public.closer_reviews for select to authenticated using (public.can_see('member'));
-- only someone who booked a call through this system with that closer can review them, once, and can change or remove their own
create policy cr_insert on public.closer_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and exists (select 1 from public.booked_calls b where b.member_id = auth.uid() and b.closer_id = closer_reviews.closer_id));
create policy cr_update on public.closer_reviews for update to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy cr_delete on public.closer_reviews for delete to authenticated using (reviewer_id = auth.uid() or public.is_admin());

-- the numbers on a call closer's card
create or replace function public.closer_stats(p_id uuid)
returns table (calls_counted integer, members_booked integer, review_count integer, avg_rating numeric, viewer_booked boolean, my_rating smallint, my_review text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    (select count(*)::int from public.booked_calls b
       where b.closer_id = p_id and b.starts_at < now()
         and b.starts_at >= coalesce((select d.counted_from from public.call_closer_details d where d.member_id = p_id), '-infinity'::timestamptz)),
    (select count(distinct b.member_id)::int from public.booked_calls b where b.closer_id = p_id),
    (select count(*)::int from public.closer_reviews r where r.closer_id = p_id),
    (select round(avg(r.rating), 1) from public.closer_reviews r where r.closer_id = p_id),
    exists (select 1 from public.booked_calls b where b.closer_id = p_id and b.member_id = auth.uid()),
    (select r.rating from public.closer_reviews r where r.closer_id = p_id and r.reviewer_id = auth.uid()),
    (select r.review from public.closer_reviews r where r.closer_id = p_id and r.reviewer_id = auth.uid())
  where public.can_see('member')
$$;
revoke all on function public.closer_stats(uuid) from public, anon;
grant execute on function public.closer_stats(uuid) to authenticated;
