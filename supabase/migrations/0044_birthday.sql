-- Profile bubble extras: birthday (month and day only, no year) and a "call closer" switch. The bubble also shows who has offered services in Outsourcing.
alter table public.profiles add column if not exists birth_month smallint check (birth_month between 1 and 12), add column if not exists birth_day smallint check (birth_day between 1 and 31);
alter table public.profiles add column if not exists call_closer boolean not null default false;
alter table public.profiles drop constraint if exists profiles_birthday_pair;
alter table public.profiles add constraint profiles_birthday_pair check ((birth_month is null) = (birth_day is null));

drop function if exists public.member_directory(text);
create function public.member_directory(p_kind text)
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, instagram text, facebook text, is_admin boolean, birth_month smallint, birth_day smallint, call_closer boolean, offers_services boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, p.instagram, p.facebook, p.role = 'admin', p.birth_month, p.birth_day, p.call_closer,
    exists (select 1 from public.outsourcing_profiles o where o.member_id = p.id and o.listed and public.is_active_affiliate(p.id))
  from public.profiles p
  where public.app_current_role() in ('member', 'admin')
    and p.onboarded_at is not null and p.removed_at is null
    and ((p_kind = 'affiliates' and p.role in ('member', 'admin') and (p.unpaid_since is null or p.unpaid_since > (current_date - interval '2 months')::date))
      or (p_kind = 'leads' and p.role = 'lead'))
  order by lower(p.first_name), lower(p.last_name)
  limit 2000
$$;
revoke all on function public.member_directory(text) from public, anon;
grant execute on function public.member_directory(text) to authenticated;
