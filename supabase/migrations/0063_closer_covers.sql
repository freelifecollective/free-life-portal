-- A call closer's cover card: a picture, where they are, how long they have been doing it, and a short bio.
-- It is asked for in the application, and a closer can change it later.
alter table public.closer_applications alter column experience drop not null;
alter table public.closer_applications drop constraint if exists closer_applications_experience_check;
alter table public.closer_applications add constraint closer_applications_experience_check check (experience is null or experience in ('none', 'some', 'lots'));
alter table public.closer_applications add column if not exists cover_url text check (cover_url is null or char_length(cover_url) <= 500);
alter table public.closer_applications add column if not exists location text check (location is null or char_length(location) <= 80);
alter table public.closer_applications add column if not exists experience_text text check (experience_text is null or char_length(experience_text) <= 40);
alter table public.closer_applications add column if not exists bio text check (bio is null or char_length(bio) <= 600);

alter table public.call_closer_details add column if not exists cover_url text check (cover_url is null or char_length(cover_url) <= 500);
alter table public.call_closer_details add column if not exists location text check (location is null or char_length(location) <= 80);
alter table public.call_closer_details add column if not exists experience_text text check (experience_text is null or char_length(experience_text) <= 40);
alter table public.call_closer_details add column if not exists bio text check (bio is null or char_length(bio) <= 600);

drop function if exists public.call_closers_directory();
create function public.call_closers_directory()
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, calls_taken text, closer_since date, close_rate numeric,
               price_per_call_cents integer, price_per_sale text, review_count integer, avg_rating numeric, members_booked integer,
               cover_url text, location text, experience_text text, bio text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, d.calls_taken, d.closer_since, d.close_rate, d.price_per_call_cents, d.price_per_sale,
         (select count(*)::int from public.closer_reviews r where r.closer_id = p.id),
         (select round(avg(r.rating), 1) from public.closer_reviews r where r.closer_id = p.id),
         (select count(distinct b.member_id)::int from public.booked_calls b where b.closer_id = p.id),
         d.cover_url, d.location, d.experience_text, d.bio
    from public.profiles p
    left join public.call_closer_details d on d.member_id = p.id
   where public.can_see('member') and p.call_closer and p.removed_at is null and p.onboarded_at is not null
   order by (select avg(r.rating) from public.closer_reviews r where r.closer_id = p.id) desc nulls last, p.first_name
$$;
revoke all on function public.call_closers_directory() from public, anon;
grant execute on function public.call_closers_directory() to authenticated;

-- approving also starts their cover card from the application
create or replace function public.review_closer_application(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.closer_applications;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into a from public.closer_applications where id = p_id and status = 'pending' for update;
  if a.id is null then raise exception 'that application is not waiting' using errcode = 'P0002'; end if;
  update public.closer_applications
     set status = case when p_approve then 'approved' else 'declined' end, review_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if p_approve then
    update public.profiles set call_closer = true where id = a.member_id;
    insert into public.call_closer_details (member_id, calls_taken, closer_since, price_per_call_cents, price_per_sale, counted_from, cover_url, location, experience_text, bio)
      values (a.member_id, a.calls_taken, current_date, a.price_per_call_cents, a.price_per_sale, now(), a.cover_url, a.location, a.experience_text, a.bio)
      on conflict (member_id) do update set price_per_call_cents = coalesce(excluded.price_per_call_cents, public.call_closer_details.price_per_call_cents),
        price_per_sale = coalesce(excluded.price_per_sale, public.call_closer_details.price_per_sale),
        cover_url = coalesce(excluded.cover_url, public.call_closer_details.cover_url), location = coalesce(excluded.location, public.call_closer_details.location),
        experience_text = coalesce(excluded.experience_text, public.call_closer_details.experience_text), bio = coalesce(excluded.bio, public.call_closer_details.bio), updated_at = now();
    perform public.notify_user(a.member_id, 'submission_result', 'Your call closer application was approved!', 'You are now listed in Call Closers for Hire.', '/call-closers');
  else
    perform public.notify_user(a.member_id, 'submission_result', 'Your call closer application was not accepted', nullif(left(btrim(coalesce(p_note, '')), 200), ''), '/call-closers');
  end if;
end $$;

-- a call closer changes their own cover card
create or replace function public.save_my_closer_card(p_cover text, p_location text, p_experience text, p_bio text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.is_call_closer(me) then raise exception 'call closers only' using errcode = '42501'; end if;
  insert into public.call_closer_details (member_id, cover_url, location, experience_text, bio)
    values (me, nullif(btrim(p_cover), ''), nullif(left(btrim(coalesce(p_location, '')), 80), ''), nullif(left(btrim(coalesce(p_experience, '')), 40), ''), nullif(left(btrim(coalesce(p_bio, '')), 600), ''))
    on conflict (member_id) do update set cover_url = coalesce(nullif(btrim(p_cover), ''), public.call_closer_details.cover_url),
      location = nullif(left(btrim(coalesce(p_location, '')), 80), ''), experience_text = nullif(left(btrim(coalesce(p_experience, '')), 40), ''),
      bio = nullif(left(btrim(coalesce(p_bio, '')), 600), ''), updated_at = now();
end $$;
revoke all on function public.save_my_closer_card(text, text, text, text) from public, anon;
grant execute on function public.save_my_closer_card(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
