-- A lead's coach (whose calendar they book) is the affiliate who invited them. If there is no invite on record, it is the affiliate who has them on a lead board (same email), or who added them to the portal.
create or replace function public.my_coach() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select r.referrer_id from public.registrations r where r.claimed_by = auth.uid() and r.referrer_id is not null order by r.created_at desc limit 1),
    (select lc.user_id from public.lead_cards lc join public.profiles me on me.id = auth.uid() join public.profiles o on o.id = lc.user_id
      where lc.email is not null and lower(btrim(lc.email)) = lower(me.email::text) and lc.affiliated_at is null and o.role in ('member', 'admin') and o.removed_at is null
      order by lc.created_at desc limit 1),
    (select a.created_by from public.signup_allowlist a join public.profiles me on me.id = auth.uid() join public.profiles o on o.id = a.created_by
      where a.email = me.email and o.role in ('member', 'admin') and o.removed_at is null limit 1)
  )
$$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;
