-- Call closers: the language they take calls in (one native language, shown first) and any others they can take calls in.
alter table public.call_closer_details add column if not exists native_language text check (native_language is null or char_length(native_language) <= 40);
alter table public.call_closer_details add column if not exists languages text[] not null default '{}';
alter table public.call_closer_details drop constraint if exists call_closer_details_languages_check;
alter table public.call_closer_details add constraint call_closer_details_languages_check check (cardinality(languages) <= 12);

create or replace function public.save_my_closer_languages(p_native text, p_languages text[]) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); nat text := nullif(left(btrim(coalesce(p_native, '')), 40), ''); others text[];
begin
  if me is null or not public.is_call_closer(me) then raise exception 'call closers only' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct l), '{}') into others from (select left(btrim(x), 40) as l from unnest(coalesce(p_languages, '{}')) x) q where l <> '' and l is distinct from nat;
  if cardinality(others) > 12 then raise exception 'too many languages' using errcode = '22023'; end if;
  insert into public.call_closer_details (member_id, native_language, languages) values (me, nat, others)
    on conflict (member_id) do update set native_language = excluded.native_language, languages = excluded.languages, updated_at = now();
end $$;
revoke all on function public.save_my_closer_languages(text, text[]) from public, anon;
grant execute on function public.save_my_closer_languages(text, text[]) to authenticated;

drop function if exists public.call_closers_directory();
create function public.call_closers_directory()
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, calls_taken text, closer_since date, close_rate numeric,
               price_per_call_cents integer, price_per_sale text, review_count integer, avg_rating numeric, members_booked integer,
               cover_url text, location text, experience_text text, bio text, paused boolean, on_waitlist boolean, native_language text, languages text[])
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, d.calls_taken, d.closer_since, d.close_rate, d.price_per_call_cents, d.price_per_sale,
         (select count(*)::int from public.closer_reviews r where r.closer_id = p.id),
         (select round(avg(r.rating), 1) from public.closer_reviews r where r.closer_id = p.id),
         (select count(distinct b.member_id)::int from public.booked_calls b where b.closer_id = p.id),
         d.cover_url, d.location, d.experience_text, d.bio, coalesce(d.paused, false),
         exists (select 1 from public.closer_waitlist w where w.closer_id = p.id and w.member_id = auth.uid()),
         d.native_language, coalesce(d.languages, '{}')
    from public.profiles p
    left join public.call_closer_details d on d.member_id = p.id
   where public.can_see('member') and p.call_closer and p.removed_at is null and p.onboarded_at is not null
   order by (select avg(r.rating) from public.closer_reviews r where r.closer_id = p.id) desc nulls last, p.first_name
$$;
revoke all on function public.call_closers_directory() from public, anon;
grant execute on function public.call_closers_directory() to authenticated;
notify pgrst, 'reload schema';
