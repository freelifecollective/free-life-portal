-- People and invites: every affiliate can invite leads, every lead belongs to the affiliate who brought them in, and messaging another affiliate's lead shows a warning.

-- the affiliate a lead belongs to: whoever's page they filled in, otherwise whoever invited them
create or replace function public.lead_owner(p_lead uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select r.referrer_id from public.registrations r where r.claimed_by = p_lead and r.referrer_id is not null order by r.created_at limit 1),
    (select a.created_by from public.signup_allowlist a join public.profiles l on l.email = a.email
      where l.id = p_lead and l.role = 'lead' and a.created_by is not null and exists (select 1 from public.profiles c where c.id = a.created_by and c.role in ('member', 'admin')) limit 1))
$$;
revoke all on function public.lead_owner(uuid) from public, anon, authenticated;

-- who a lead belongs to (affiliates only)
create or replace function public.lead_owner_info(p_lead uuid) returns table (owner_id uuid, first_name text, last_name text, avatar_url text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.id, o.first_name, o.last_name, o.avatar_url
    from public.profiles l join public.profiles o on o.id = public.lead_owner(l.id)
   where l.id = p_lead and l.role = 'lead' and public.app_current_role() in ('member', 'admin')
$$;
revoke all on function public.lead_owner_info(uuid) from public, anon;
grant execute on function public.lead_owner_info(uuid) to authenticated;

-- true when the person you are about to message is a lead who belongs to someone else
create or replace function public.message_lead_warning(p_other uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.app_current_role() = 'member'
     and exists (select 1 from public.profiles l where l.id = p_other and l.role = 'lead')
     and coalesce(public.lead_owner(p_other) is distinct from auth.uid(), true)
$$;
revoke all on function public.message_lead_warning(uuid) from public, anon;
grant execute on function public.message_lead_warning(uuid) to authenticated;

-- any paying affiliate can invite a lead by email; the lead then belongs to them
create or replace function public.invite_lead(p_email text, p_note text default null) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); em text := lower(btrim(coalesce(p_email, '')));
begin
  if me is null or not public.is_active_affiliate(me) then raise exception 'paying affiliates only' using errcode = '42501'; end if;
  if em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or char_length(em) > 254 then raise exception 'that does not look like an email' using errcode = '22023'; end if;
  if (select count(*) from public.signup_allowlist where created_by = me and claimed_at is null) >= 200 then raise exception 'too many waiting invites' using errcode = '23514'; end if;
  if exists (select 1 from public.signup_allowlist where email = em::citext) or exists (select 1 from public.profiles where email = em::citext) then return 'exists'; end if;
  insert into public.signup_allowlist (email, role, note, created_by) values (em, 'lead', left(nullif(btrim(coalesce(p_note, '')), ''), 200), me);
  return 'invited';
end $$;
revoke all on function public.invite_lead(text, text) from public, anon;
grant execute on function public.invite_lead(text, text) to authenticated;

-- the leads you have invited
create or replace function public.my_invites() returns table (email text, note text, created_at timestamptz, claimed_at timestamptz, first_name text, last_name text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select a.email::text, a.note, a.created_at, a.claimed_at, p.first_name, p.last_name
    from public.signup_allowlist a left join public.profiles p on p.email = a.email
   where a.created_by = auth.uid() and a.role = 'lead' and public.app_current_role() in ('member', 'admin')
   order by a.created_at desc limit 300
$$;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- admin: one affiliate's people (everyone they invited, and everyone who filled in their page)
create or replace function public.admin_affiliate_people(p_affiliate uuid)
returns table (kind text, email text, first_name text, last_name text, created_at timestamptz, in_portal boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select * from (
    select 'invited'::text, a.email::text, p.first_name, p.last_name, a.created_at, a.claimed_at is not null
      from public.signup_allowlist a left join public.profiles p on p.email = a.email where a.created_by = p_affiliate
    union all
    select 'form'::text, r.email::text, r.first_name, r.last_name, r.created_at, r.claimed_by is not null
      from public.registrations r where r.referrer_id = p_affiliate
  ) x (kind, email, first_name, last_name, created_at, in_portal)
  where public.app_current_role() = 'admin'
  order by created_at desc limit 1000
$$;
revoke all on function public.admin_affiliate_people(uuid) from public, anon;
grant execute on function public.admin_affiliate_people(uuid) to authenticated;
-- admin: leads who have an account, and the affiliate each belongs to
create or replace function public.admin_leads_with_owner()
returns table (id uuid, first_name text, last_name text, email text, created_at timestamptz, owner_id uuid, owner_first text, owner_last text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select l.id, l.first_name, l.last_name, l.email::text, l.created_at, o.id, o.first_name, o.last_name
    from public.profiles l left join public.profiles o on o.id = public.lead_owner(l.id)
   where l.role = 'lead' and l.onboarded_at is not null and l.removed_at is null and public.app_current_role() = 'admin'
   order by l.created_at desc limit 1000
$$;
revoke all on function public.admin_leads_with_owner() from public, anon;
grant execute on function public.admin_leads_with_owner() to authenticated;
notify pgrst, 'reload schema';
