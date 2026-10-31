-- Where each person lives (a two-letter country code). Private: only the person and admins can read it.
-- It starts the Earnings Estimator on the right country, and lets admins see how many members live in each country.
alter table public.profiles add column if not exists country text;
alter table public.profiles drop constraint if exists profiles_country_code;
alter table public.profiles add constraint profiles_country_code check (country is null or country ~ '^[A-Z]{2}$');

-- Admins only: how many members (and leads) there are in each country, plus those who have not said yet (country is null).
create or replace function public.admin_country_counts() returns table (country text, members integer, leads integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.country,
         (count(*) filter (where p.role in ('member', 'admin')))::integer,
         (count(*) filter (where p.role = 'lead'))::integer
    from public.profiles p
   where public.is_admin() and p.onboarded_at is not null and p.removed_at is null
   group by p.country
   order by 2 desc, 3 desc
$$;
revoke all on function public.admin_country_counts() from public, anon;
grant execute on function public.admin_country_counts() to authenticated;

notify pgrst, 'reload schema';
