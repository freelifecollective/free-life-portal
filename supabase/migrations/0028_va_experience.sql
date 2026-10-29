-- Outsourcing listings: "Do you have experience as a VA, and for how long?"
alter table public.outsourcing_profiles
  add column va_experience boolean,
  add column va_experience_length text check (va_experience_length in ('Less than 6 months', '6 months to 1 year', '1 to 2 years', '2 to 5 years', 'More than 5 years')),
  add constraint outsourcing_va_length check (va_experience is distinct from true or va_experience_length is not null),
  add constraint outsourcing_va_length_only_if_yes check (va_experience is true or va_experience_length is null);

-- the directory now carries the answer (the old version is replaced because its columns change)
drop function public.outsourcing_directory();
create function public.outsourcing_directory() returns table (
  member_id uuid, first_name text, last_name text, username citext, avatar_url text, is_admin boolean,
  headline text, about text, tasks text[], hourly_rate_cents integer, hires integer, reviews integer, avg_rating numeric,
  va_experience boolean, va_experience_length text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.member_id, p.first_name, p.last_name, p.username, p.avatar_url, p.role = 'admin',
         o.headline, o.about, o.tasks, o.hourly_rate_cents,
         (select count(*)::integer from public.outsourcing_hires h where h.provider_id = o.member_id),
         (select count(*)::integer from public.outsourcing_hires h where h.provider_id = o.member_id and h.rating is not null),
         (select round(avg(h.rating)::numeric, 1) from public.outsourcing_hires h where h.provider_id = o.member_id and h.rating is not null),
         o.va_experience, o.va_experience_length
  from public.outsourcing_profiles o join public.profiles p on p.id = o.member_id
  where public.can_see('member') and o.listed and public.is_active_affiliate(o.member_id)
  order by p.first_name, p.last_name
$$;
revoke all on function public.outsourcing_directory() from public, anon;
grant execute on function public.outsourcing_directory() to authenticated;
