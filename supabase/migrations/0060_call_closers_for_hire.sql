-- Call Closers for Hire: a list of every call closer for affiliates to browse, and an application to become one that admins approve or decline.

-- Everyone who is a call closer, with the numbers shown on their card. Affiliates cannot read other people's profile rows, so this is a function.
create or replace function public.call_closers_directory()
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, calls_taken text, closer_since date, close_rate numeric,
               price_per_call_cents integer, price_per_sale text, review_count integer, avg_rating numeric, members_booked integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, d.calls_taken, d.closer_since, d.close_rate, d.price_per_call_cents, d.price_per_sale,
         (select count(*)::int from public.closer_reviews r where r.closer_id = p.id),
         (select round(avg(r.rating), 1) from public.closer_reviews r where r.closer_id = p.id),
         (select count(distinct b.member_id)::int from public.booked_calls b where b.closer_id = p.id)
    from public.profiles p
    left join public.call_closer_details d on d.member_id = p.id
   where public.can_see('member') and p.call_closer and p.removed_at is null and p.onboarded_at is not null
   order by (select avg(r.rating) from public.closer_reviews r where r.closer_id = p.id) desc nulls last, p.first_name
$$;
revoke all on function public.call_closers_directory() from public, anon;
grant execute on function public.call_closers_directory() to authenticated;

-- Applications to become a call closer.
create table if not exists public.closer_applications (
  id                   uuid primary key default gen_random_uuid(),
  member_id            uuid not null references public.profiles (id) on delete cascade,
  status               text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  experience           text not null check (experience in ('none', 'some', 'lots')),
  calls_taken          text check (calls_taken is null or char_length(calls_taken) <= 40),
  availability         text not null check (char_length(btrim(availability)) between 1 and 400),
  pitch                text not null check (char_length(btrim(pitch)) between 1 and 1500),
  price_per_call_cents integer check (price_per_call_cents is null or price_per_call_cents between 0 and 10000000),
  price_per_sale       text check (price_per_sale is null or char_length(price_per_sale) <= 400),
  agreed               boolean not null check (agreed),
  review_note          text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by          uuid references public.profiles (id) on delete set null,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now()
);
create unique index if not exists closer_applications_one_open on public.closer_applications (member_id) where status = 'pending';
alter table public.closer_applications enable row level security;
drop policy if exists ca_read on public.closer_applications;
create policy ca_read on public.closer_applications for select to authenticated using (member_id = auth.uid() or public.is_admin());
drop policy if exists ca_insert on public.closer_applications;
create policy ca_insert on public.closer_applications for insert to authenticated
  with check (member_id = auth.uid() and status = 'pending' and public.can_see('member') and not public.is_call_closer(auth.uid()));
drop policy if exists ca_withdraw on public.closer_applications;
create policy ca_withdraw on public.closer_applications for delete to authenticated using ((member_id = auth.uid() and status = 'pending') or public.is_admin());

-- tell the admins when one arrives
create or replace function public.notify_closer_application() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare nm text;
begin
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = new.member_id;
  insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'announcement', 'New call closer application', nm || ' wants to become a call closer.', '/admin/closer-applications'
      from public.profiles p where p.role = 'admin' and p.onboarded_at is not null;
  return new;
end $$;
drop trigger if exists closer_applications_notify on public.closer_applications;
create trigger closer_applications_notify after insert on public.closer_applications for each row execute function public.notify_closer_application();

-- An admin approves or declines. Approving makes them a call closer and starts their card with what they wrote; the applicant is told either way.
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
    insert into public.call_closer_details (member_id, calls_taken, closer_since, price_per_call_cents, price_per_sale, counted_from)
      values (a.member_id, a.calls_taken, current_date, a.price_per_call_cents, a.price_per_sale, now())
      on conflict (member_id) do update set price_per_call_cents = coalesce(excluded.price_per_call_cents, public.call_closer_details.price_per_call_cents),
        price_per_sale = coalesce(excluded.price_per_sale, public.call_closer_details.price_per_sale), updated_at = now();
    perform public.notify_user(a.member_id, 'submission_result', 'Your call closer application was approved!', 'You are now listed in Call Closers for Hire.', '/call-closers');
  else
    perform public.notify_user(a.member_id, 'submission_result', 'Your call closer application was not accepted', nullif(left(btrim(coalesce(p_note, '')), 200), ''), '/call-closers');
  end if;
end $$;
revoke all on function public.review_closer_application(uuid, boolean, text) from public, anon;
grant execute on function public.review_closer_application(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
