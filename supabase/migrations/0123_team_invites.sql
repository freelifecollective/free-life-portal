-- My Team: ranks start at 1A, a team member is picked from your leads (or invited by email), and someone who is listed leaves your lead boards.
alter table public.team_members add column invited_at timestamptz;
alter table public.team_members alter column rank set default '1A';
update public.team_members set rank = '1A' where rank = 'New';
update public.team_members set calls_until_rank = null where calls_until_rank = 'New';

-- the order of ranks, used when a coach takes a new affiliate's calls "until a rank"
create or replace function public.booking_target(p_coach uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select h.closer_id from public.closer_hires h where h.member_id = p_coach and h.status = 'active' limit 1),
    (select t.user_id from public.team_members t
      where t.linked_profile = p_coach and t.calls_mode is not null
        and (t.calls_until_rank is null
             or coalesce(array_position(array['1A', '2A', '3A', '4A', '5A', '6A', '6A2', '6A2-2', '6A2-3', '6A2-4', '6A2-5', '6A2-6', '6A2-7', '6A2-8'], t.rank), 0)
                < coalesce(array_position(array['1A', '2A', '3A', '4A', '5A', '6A', '6A2', '6A2-2', '6A2-3', '6A2-4', '6A2-5', '6A2-6', '6A2-7', '6A2-8'], t.calls_until_rank), 99))
      order by t.created_at limit 1),
    p_coach)
$$;

-- "Affiliated" on a lead card (starts at 1A)
create or replace function public.lead_affiliated(p_card uuid, p_rank text default '1A') returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); c public.lead_cards; t uuid; link uuid;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  select * into c from public.lead_cards where id = p_card and user_id = me;
  if not found then raise exception 'not your card' using errcode = '42501'; end if;
  if c.email is not null then select p.id into link from public.profiles p where p.email = lower(btrim(c.email))::citext and p.id <> me limit 1; end if;
  select id into t from public.team_members where user_id = me and ((link is not null and linked_profile = link) or (c.email is not null and lower(email) = lower(btrim(c.email)))) limit 1;
  if t is null then
    insert into public.team_members (user_id, name, email, rank, linked_profile) values (me, c.name, nullif(btrim(coalesce(c.email, '')), ''), coalesce(nullif(btrim(p_rank), ''), '1A'), link) returning id into t;
    perform public.make_team_checks(t, me);
  end if;
  update public.lead_cards set affiliated_at = now() where id = p_card;
  return t;
end $$;

-- Adding someone to your team. Anyone with the same email who is on your lead boards leaves them.
-- needs_invite is true when that person has no account in the portal yet.
create or replace function public.team_add_member(p_name text, p_email text, p_rank text default '1A', p_card uuid default null)
returns table (id uuid, needs_invite boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); em text := lower(btrim(coalesce(p_email, ''))); nm text := left(btrim(coalesce(p_name, '')), 80); link uuid; t uuid;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if nm = '' then raise exception 'name needed' using errcode = '22023'; end if;
  if em <> '' and (em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or char_length(em) > 254) then raise exception 'that does not look like an email' using errcode = '22023'; end if;
  if em <> '' then select p.id into link from public.profiles p where p.email = em::citext and p.id <> me limit 1; end if;
  select m.id into t from public.team_members m where m.user_id = me and ((em <> '' and lower(m.email) = em) or (link is not null and m.linked_profile = link)) limit 1;
  if t is null then
    insert into public.team_members (user_id, name, email, rank, linked_profile) values (me, nm, nullif(em, ''), coalesce(nullif(btrim(p_rank), ''), '1A'), link) returning team_members.id into t;
    perform public.make_team_checks(t, me);
  end if;
  -- off the lead boards (by card, and by email)
  update public.lead_cards set affiliated_at = now() where user_id = me and affiliated_at is null and (lead_cards.id = p_card or (em <> '' and lower(lead_cards.email) = em));
  return query select t, (em <> '' and link is null);
end $$;
revoke all on function public.team_add_member(text, text, text, uuid) from public, anon;
grant execute on function public.team_add_member(text, text, text, uuid) to authenticated;

-- Invite a team member who is not in the portal: they can create an account (they start as the unpaid kind, and choose a plan after the welcome steps).
create or replace function public.invite_team_member(p_member uuid) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); t public.team_members; em text;
begin
  if me is null or not public.is_active_affiliate(me) then raise exception 'paying affiliates only' using errcode = '42501'; end if;
  select * into t from public.team_members where id = p_member and user_id = me;
  if not found or t.email is null then raise exception 'not your team member' using errcode = '42501'; end if;
  em := lower(btrim(t.email));
  if exists (select 1 from public.profiles where email = em::citext) then return 'exists'; end if;
  if (select count(*) from public.signup_allowlist where created_by = me and claimed_at is null) >= 200 then raise exception 'too many waiting invites' using errcode = '23514'; end if;
  insert into public.signup_allowlist (email, role, note, created_by) values (em, 'downline', left('Team member of ' || coalesce((select first_name from public.profiles where id = me), 'a coach'), 200), me) on conflict do nothing;
  update public.team_members set invited_at = now() where id = p_member;
  return 'invited';
end $$;
revoke all on function public.invite_team_member(uuid) from public, anon;
grant execute on function public.invite_team_member(uuid) to authenticated;

-- when the invited person creates their account, they appear on the coach's team as a registered member
create or replace function public.profiles_link_team() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.email is not null then
    update public.team_members set linked_profile = new.id where linked_profile is null and email is not null and lower(email) = lower(new.email::text);
  end if;
  return null;
end $$;
drop trigger if exists profiles_link_team on public.profiles;
create trigger profiles_link_team after insert on public.profiles for each row execute function public.profiles_link_team();

drop function if exists public.my_team_overview();
create function public.my_team_overview()
returns table (id uuid, name text, email text, rank text, status text, last_check_in_at timestamptz, last_check_in_note text, started boolean, done_lessons integer, total_lessons integer, calls_mode text, calls_until_rank text)
language sql stable security definer set search_path = public, pg_temp
as $$
  with launch as (
    select c.id from public.classroom_courses c where c.title ilike 'business launch%' and c.published order by c.sort limit 1
  ), total as (
    select count(*)::int n from public.classroom_lessons l join launch on l.course_id = launch.id where l.published
  )
  select t.id, t.name, t.email, t.rank,
         case when t.status_override is not null then t.status_override
              when p.id is not null and p.role in ('member', 'admin') and p.removed_at is null
                   and (p.unpaid_since is null or p.unpaid_since > (current_date - interval '2 months')::date) then 'active'
              when p.id is not null and p.removed_at is null and p.role in ('downline', 'lead') then 'registered'
              when p.id is null and t.invited_at is not null then 'invited'
              else 'not_in_portal' end,
         t.last_check_in_at, t.last_check_in_note,
         coalesce(d.n, 0) > 0, coalesce(d.n, 0), (select n from total), t.calls_mode, t.calls_until_rank
    from public.team_members t
    left join public.profiles p on p.id = t.linked_profile
    left join lateral (
      select count(*)::int n from public.classroom_progress cp join public.classroom_lessons l on l.id = cp.lesson_id
       where cp.user_id = t.linked_profile and l.published and l.course_id = (select id from launch)
    ) d on true
   where t.user_id = auth.uid() and public.can_see('member')
$$;
revoke all on function public.my_team_overview() from public, anon;
grant execute on function public.my_team_overview() to authenticated;
