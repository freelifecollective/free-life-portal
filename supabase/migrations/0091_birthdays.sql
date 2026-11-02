-- Birthdays: a thin banner for paying affiliates on someone's birthday, a wishes chat for that day, and a card the birthday person keeps.
-- Wishes are only ever read or written through the functions below (the table has no direct access).
create table if not exists public.birthday_wishes (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.profiles(id) on delete cascade,
  year       integer not null check (year between 2000 and 2200),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists birthday_wishes_person_idx on public.birthday_wishes (person_id, year, created_at);
alter table public.birthday_wishes enable row level security;
revoke all on public.birthday_wishes from public, anon, authenticated;

-- true while it is (anywhere on Earth, give or take a day) this person's birthday in that year
create or replace function public.birthday_open(p_person uuid, p_year integer) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p, unnest(array[current_date - 1, current_date, current_date + 1]) d
     where p.id = p_person and p.birth_month is not null
       and p.birth_month = extract(month from d) and p.birth_day = extract(day from d) and p_year = extract(year from d))
$$;
revoke all on function public.birthday_open(uuid, integer) from public, anon, authenticated;

-- whose birthday it is on the viewer's own local date (paying affiliates only; the date may only be within a day of today)
create or replace function public.birthdays_today(p_day date) returns table (id uuid, first_name text, last_name text, avatar_url text, year integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.avatar_url, extract(year from p_day)::integer
    from public.profiles p
   where public.is_active_affiliate(auth.uid())
     and p_day between current_date - 1 and current_date + 1
     and p.birth_month = extract(month from p_day) and p.birth_day = extract(day from p_day)
     and p.role in ('member', 'admin') and public.is_active_affiliate(p.id)
   order by lower(p.first_name), lower(p.last_name)
   limit 12
$$;
revoke all on function public.birthdays_today(date) from public, anon;
grant execute on function public.birthdays_today(date) to authenticated;

create or replace function public.post_birthday_wish(p_person uuid, p_year integer, p_body text) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); nid uuid; body text := btrim(coalesce(p_body, ''));
begin
  if me is null or not public.is_active_affiliate(me) then raise exception 'paying affiliates only' using errcode = '42501'; end if;
  if char_length(body) not between 1 and 500 then raise exception 'write 1 to 500 characters' using errcode = '22023'; end if;
  if not public.birthday_open(p_person, p_year) then raise exception 'it is not their birthday' using errcode = '42501'; end if;
  insert into public.birthday_wishes (person_id, year, author_id, body) values (p_person, p_year, me, body) returning id into nid;
  return nid;
end $$;
revoke all on function public.post_birthday_wish(uuid, integer, text) from public, anon;
grant execute on function public.post_birthday_wish(uuid, integer, text) to authenticated;

-- the wishes for one birthday: the birthday person can always read theirs; paying affiliates only while the day is on
create or replace function public.birthday_wishes_list(p_person uuid, p_year integer)
returns table (id uuid, author_id uuid, first_name text, last_name text, avatar_url text, body text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select w.id, w.author_id, a.first_name, a.last_name, a.avatar_url, w.body, w.created_at, w.author_id = auth.uid()
    from public.birthday_wishes w join public.profiles a on a.id = w.author_id
   where w.person_id = p_person and w.year = p_year
     and (p_person = auth.uid() or (public.is_active_affiliate(auth.uid()) and public.birthday_open(p_person, p_year)))
   order by w.created_at
   limit 500
$$;
revoke all on function public.birthday_wishes_list(uuid, integer) from public, anon;
grant execute on function public.birthday_wishes_list(uuid, integer) to authenticated;

create or replace function public.delete_birthday_wish(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from public.birthday_wishes w
   where w.id = p_id and (w.author_id = auth.uid() or exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin'));
end $$;
revoke all on function public.delete_birthday_wish(uuid) from public, anon;
grant execute on function public.delete_birthday_wish(uuid) to authenticated;

-- the birthdays you have cards for
create or replace function public.my_birthday_cards() returns table (year integer, wishes bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select w.year, count(*) from public.birthday_wishes w where w.person_id = auth.uid() group by w.year order by w.year desc
$$;
revoke all on function public.my_birthday_cards() from public, anon;
grant execute on function public.my_birthday_cards() to authenticated;
-- who the party is for, and whether the day is still on
create or replace function public.birthday_person(p_person uuid, p_year integer)
returns table (first_name text, last_name text, avatar_url text, is_open boolean, is_me boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.first_name, p.last_name, p.avatar_url, public.birthday_open(p.id, p_year), p.id = auth.uid()
    from public.profiles p
   where p.id = p_person and p.onboarded_at is not null and p.removed_at is null and p.role in ('member', 'admin')
     and (p.id = auth.uid() or public.is_active_affiliate(auth.uid()))
$$;
revoke all on function public.birthday_person(uuid, integer) from public, anon;
grant execute on function public.birthday_person(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
