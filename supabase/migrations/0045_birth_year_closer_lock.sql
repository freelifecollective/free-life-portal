-- Optional birth year, and "call closer" becomes something only an admin can switch on (members apply instead).
alter table public.profiles add column if not exists birth_year smallint check (birth_year between 1900 and 2100);
alter table public.profiles drop constraint if exists profiles_birth_year_needs_day;
alter table public.profiles add constraint profiles_birth_year_needs_day check (birth_year is null or birth_month is not null);

create or replace function public.profiles_before_write() returns trigger
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  by_user boolean := current_user in ('authenticated', 'anon');
begin
  new.updated_at := now();

  if new.username is not null then
    new.username := lower(new.username::text)::citext;
    if (tg_op = 'INSERT' or new.username is distinct from old.username)
       and public.is_reserved_username(new.username::text) then
      raise exception 'username_reserved' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and by_user and not public.is_admin() then
    if new.id is distinct from old.id then raise exception 'profile id is immutable' using errcode = '42501'; end if;
    if new.email is distinct from old.email then raise exception 'email cannot be changed here' using errcode = '42501'; end if;
    if new.role is distinct from old.role then raise exception 'role can only be changed by an admin' using errcode = '42501'; end if;
    if new.coach_id is distinct from old.coach_id then raise exception 'coach can only be changed by an admin' using errcode = '42501'; end if;
    if new.unpaid_since is distinct from old.unpaid_since or new.removed_at is distinct from old.removed_at then
      raise exception 'membership status can only be changed by an admin' using errcode = '42501';
    end if;
    if new.call_closer is distinct from old.call_closer then
      raise exception 'call closer status can only be changed by an admin' using errcode = '42501';
    end if;
    if old.onboarded_at is not null and new.onboarded_at is distinct from old.onboarded_at then
      raise exception 'onboarding is already complete' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Sonya is a call closer
update public.profiles set call_closer = true where username = 'sonyafruthven';

drop function if exists public.member_directory(text);
create function public.member_directory(p_kind text)
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, instagram text, facebook text, is_admin boolean, birth_month smallint, birth_day smallint, birth_year smallint, call_closer boolean, offers_services boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, p.instagram, p.facebook, p.role = 'admin', p.birth_month, p.birth_day, p.birth_year, p.call_closer,
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
