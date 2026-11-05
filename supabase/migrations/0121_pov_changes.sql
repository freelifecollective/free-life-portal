-- 1. The middle plan is $97 (not $77).
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.plan_purchases drop constraint if exists plan_purchases_tier_check;
alter table public.plan_interest drop constraint if exists plan_interest_tier_check;
update public.profiles set plan = 97 where plan = 77;
update public.plan_purchases set tier = 97 where tier = 77;
update public.plan_interest set tier = 97 where tier = 77;
alter table public.profiles add constraint profiles_plan_check check (plan is null or plan in (47, 97, 297));
alter table public.plan_purchases add constraint plan_purchases_tier_check check (tier in (47, 97, 297));
alter table public.plan_interest add constraint plan_interest_tier_check check (tier in (47, 97, 297));
create or replace function public.plan_counts() returns table (tier smallint, n integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select t.tier, (select count(*)::int from public.profiles p where p.plan = t.tier and p.removed_at is null)
    from (values (47::smallint), (97::smallint), (297::smallint)) as t(tier)
   where auth.uid() is not null
$$;

-- 2. Lacey's downline can see the recordings that are switched on for them.
drop policy if exists rec_read on public.recordings;
create policy rec_read on public.recordings for select to authenticated using (
  public.is_admin() or (published and (public.can_see('member') or (for_leads and public.app_current_role() = 'lead') or (for_downline and public.app_current_role() = 'downline'))));

-- 3. Lacey's downline sees every chat (locked ones show a lock; they cannot read what is said in them).
drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select to authenticated using (
  case when public.app_current_role() = 'downline' then true
       else min_role <> 'downline' or public.can_see('downline') end);
drop policy if exists chat_sections_read on public.chat_sections;
create policy chat_sections_read on public.chat_sections for select to authenticated using (
  case when public.app_current_role() = 'downline' then true
       else min_role <> 'downline' or public.can_see('downline') end);

-- 4. A coach can take a new affiliate's coaching calls for them, or together with them (always, or until the affiliate reaches a rank).
alter table public.team_members
  add column calls_mode text check (calls_mode in ('for', 'together')),
  add column calls_until_rank text check (calls_until_rank is null or char_length(calls_until_rank) between 1 and 20);

create or replace function public.booking_target(p_coach uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select h.closer_id from public.closer_hires h where h.member_id = p_coach and h.status = 'active' limit 1),
    (select t.user_id from public.team_members t
      where t.linked_profile = p_coach and t.calls_mode is not null
        and (t.calls_until_rank is null
             or coalesce(array_position(array['New', '6A', '6A2', '6A2-2', '6A2-3', '6A2-4', '6A2-5', '6A2-6', '6A2-7', '6A2-8'], t.rank), 0)
                < coalesce(array_position(array['New', '6A', '6A2', '6A2-2', '6A2-3', '6A2-4', '6A2-5', '6A2-6', '6A2-7', '6A2-8'], t.calls_until_rank), 99))
      order by t.created_at limit 1),
    p_coach)
$$;

create or replace function public.set_team_call_plan(p_member uuid, p_mode text, p_until text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_mode is not null and p_mode not in ('for', 'together') then raise exception 'bad mode' using errcode = '22023'; end if;
  update public.team_members set calls_mode = p_mode, calls_until_rank = case when p_mode is null then null else nullif(btrim(coalesce(p_until, '')), '') end
   where id = p_member and user_id = auth.uid();
  if not found then raise exception 'not your team member' using errcode = '42501'; end if;
end $$;
revoke all on function public.set_team_call_plan(uuid, text, text) from public, anon;
grant execute on function public.set_team_call_plan(uuid, text, text) to authenticated;

-- the team list also says who takes the calls
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
