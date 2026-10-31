-- "FLC members who have booked them" can be typed in by an admin; new bookings add to it automatically, like calls taken.
alter table public.call_closer_details add column if not exists members_booked text check (members_booked is null or char_length(members_booked) <= 40);
alter table public.call_closer_details add column if not exists members_counted_from timestamptz;

drop function if exists public.closer_stats(uuid);
create function public.closer_stats(p_id uuid)
returns table (calls_counted integer, members_booked integer, review_count integer, avg_rating numeric, viewer_booked boolean, my_rating smallint, my_review text, members_counted integer, members_base text)
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
    (select r.review from public.closer_reviews r where r.closer_id = p_id and r.reviewer_id = auth.uid()),
    -- members who booked since the typed figure was set (all of them if nothing was typed)
    (select count(distinct b.member_id)::int from public.booked_calls b
       where b.closer_id = p_id
         and b.created_at >= coalesce((select d.members_counted_from from public.call_closer_details d where d.member_id = p_id), '-infinity'::timestamptz)),
    (select d.members_booked from public.call_closer_details d where d.member_id = p_id)
  where public.can_see('member')
$$;
revoke all on function public.closer_stats(uuid) from public, anon;
grant execute on function public.closer_stats(uuid) to authenticated;

-- past reviews: an admin can add a review on behalf of an FLC member who worked with a closer before the portal had bookings
alter table public.closer_reviews add column if not exists imported boolean not null default false;
drop policy if exists cr_admin_insert on public.closer_reviews;
create policy cr_admin_insert on public.closer_reviews for insert to authenticated with check (public.is_admin());
drop policy if exists cr_admin_update on public.closer_reviews;
create policy cr_admin_update on public.closer_reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());
