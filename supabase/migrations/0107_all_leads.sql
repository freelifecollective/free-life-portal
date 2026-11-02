-- For admins: one full list of leads (people with an account, people who were invited, and people who filled in a form), with the affiliate each one belongs to.
create or replace function public.admin_all_leads()
returns table (source text, id uuid, first_name text, last_name text, email text, created_at timestamptz, in_portal boolean, owner_id uuid, owner_first text, owner_last text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select x.source, x.id, x.first_name, x.last_name, x.email, x.created_at, x.in_portal, x.owner_id, o.first_name, o.last_name
    from (
      select distinct on (u.email) u.* from (
        select 1 as prio, 'account'::text as source, p.id, p.first_name, p.last_name, p.email::text as email, p.created_at, true as in_portal, public.lead_owner(p.id) as owner_id
          from public.profiles p where p.role = 'lead' and p.onboarded_at is not null and p.removed_at is null and p.email is not null
        union all
        select 2, 'invited', null::uuid, null::text, null::text, a.email::text, a.created_at, a.claimed_at is not null, a.created_by
          from public.signup_allowlist a where a.role = 'lead' and a.created_by is not null
        union all
        select 3, 'form', null::uuid, r.first_name, r.last_name, r.email::text, r.created_at, r.claimed_by is not null, r.referrer_id
          from public.registrations r
      ) u order by u.email, u.prio
    ) x
    left join public.profiles o on o.id = x.owner_id
   where public.is_admin()
   order by x.created_at desc
   limit 3000
$$;
revoke all on function public.admin_all_leads() from public, anon;
grant execute on function public.admin_all_leads() to authenticated;
notify pgrst, 'reload schema';
