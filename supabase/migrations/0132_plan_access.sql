-- Plan access. Seven plans: $33 founders, and $47 / $97 / $297, each for Lacey's Downline or for people outside it.
-- profiles.plan says which tier (47, 97, 297); these columns say which version and whether the founders price applies.

-- founder: joined at the founders price ($33 Starter). It is kept through upgrades and downgrades while payments continue.
-- founder_lost_at: when the founders price ended (two missed payments in a row, or cancelling). From then on Starter is $47.
-- lacey_downline: part of Lacey's Downline. Stays true when a free downline account starts paying.
alter table public.profiles
  add column founder boolean not null default false,
  add column founder_lost_at timestamptz,
  add column lacey_downline boolean not null default false;

update public.profiles set lacey_downline = true where role = 'downline';

-- new downline accounts are marked as Lacey's Downline from the start
create or replace function public.profiles_downline_mark() returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.role = 'downline' then new.lacey_downline := true; end if;
  return new;
end $$;
create trigger profiles_downline_mark before insert or update of role on public.profiles for each row execute function public.profiles_downline_mark();

-- only an admin (or the payment system, later) can change someone's plan, founders price or downline mark
create or replace function public.profiles_plan_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.plan is distinct from old.plan
    or new.founder is distinct from old.founder
    or new.founder_lost_at is distinct from old.founder_lost_at
    or (new.lacey_downline is distinct from old.lacey_downline and not (new.role = 'downline' and new.lacey_downline))
  ) then
    raise exception 'plan can only be changed by an admin' using errcode = '42501';
  end if;
  return new;
end $$;

-- is the signed-in person on this plan or a higher one? Admins always are. Used by Builder and Leader features.
create or replace function public.plan_at_least(min_tier smallint) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_admin() or exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.removed_at is null and p.plan is not null and p.plan >= min_tier)
$$;
revoke all on function public.plan_at_least(smallint) from public, anon;
grant execute on function public.plan_at_least(smallint) to authenticated;
