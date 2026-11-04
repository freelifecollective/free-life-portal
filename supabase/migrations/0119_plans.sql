-- Paid plans ($47, $77, $297 a month): which plan each paying member is on, how many are on each, and who joined lately (for the sales page).
alter table public.profiles add column plan smallint check (plan is null or plan in (47, 77, 297));
create index profiles_plan_idx on public.profiles (plan) where plan is not null;

-- only an admin (or the payment system, later) can put someone on a plan
create or replace function public.profiles_plan_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.plan is distinct from old.plan and auth.uid() is not null and not public.is_admin() then
    raise exception 'plan can only be changed by an admin' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_plan_guard before update on public.profiles for each row execute function public.profiles_plan_guard();

-- each time someone starts a plan, a line for the "just purchased" bubble (first name only)
create table public.plan_purchases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 40),
  tier       smallint not null check (tier in (47, 77, 297)),
  created_at timestamptz not null default now()
);
alter table public.plan_purchases enable row level security;
create policy pp_admin on public.plan_purchases for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.profiles_plan_started() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.plan is not null and new.plan is distinct from old.plan then
    insert into public.plan_purchases (user_id, first_name, tier) values (new.id, coalesce(nullif(btrim(new.first_name), ''), 'Someone'), new.plan);
  end if;
  return null;
end $$;
create trigger profiles_plan_started after update of plan on public.profiles for each row execute function public.profiles_plan_started();

-- how many paying members are on each plan (anyone signed in can see the numbers)
create or replace function public.plan_counts() returns table (tier smallint, n integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select t.tier, (select count(*)::int from public.profiles p where p.plan = t.tier and p.removed_at is null)
    from (values (47::smallint), (77::smallint), (297::smallint)) as t(tier)
   where auth.uid() is not null
$$;
revoke all on function public.plan_counts() from public, anon;
grant execute on function public.plan_counts() to authenticated;

-- the latest plan starts, for the little bubble
create or replace function public.recent_plan_purchases() returns table (first_name text, tier smallint, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select pp.first_name, pp.tier, pp.created_at from public.plan_purchases pp
   where auth.uid() is not null and pp.created_at > now() - interval '60 days'
   order by pp.created_at desc limit 20
$$;
revoke all on function public.recent_plan_purchases() from public, anon;
grant execute on function public.recent_plan_purchases() to authenticated;

-- who tapped "Choose this plan" (until checkout is connected)
create table public.plan_interest (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tier       smallint not null check (tier in (47, 77, 297)),
  created_at timestamptz not null default now()
);
alter table public.plan_interest enable row level security;
create policy pi_insert on public.plan_interest for insert to authenticated with check (user_id = auth.uid());
create policy pi_read on public.plan_interest for select to authenticated using (user_id = auth.uid() or public.is_admin());
