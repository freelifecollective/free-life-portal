-- Tell people when someone new joins the pool and lands in their top 5.

create function public.ab_matches_for(p_me uuid) returns table (member_id uuid, first_name text, last_name text, username citext, avatar_url text, score integer, reasons text[], is_top boolean)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare me uuid := p_me; mine record; my_off numeric; my_rank smallint; my_kids integer[]; my_age numeric;
begin
  if me is null or not exists (select 1 from public.profiles pr where pr.id = me and pr.role in ('member', 'admin')) then return; end if;
  select a.* into mine from public.ab_profiles a where a.member_id = me and a.complete and a.pool_status = 'in_pool';
  if not found then return; end if;
  select mp0.rank_id into my_rank from public.member_private mp0 where mp0.member_id = me;
  if my_rank is null then return; end if;
  my_off := public.ab_offset(mine.answers -> 'tz' ->> 'tz');
  my_kids := public.ab_kids(mine.answers -> 'kids');
  my_age := case when jsonb_typeof(mine.answers -> 'age') = 'number' then (mine.answers ->> 'age')::numeric end;

  return query
  with cand as (
    select p.id, p.first_name as fn, p.last_name as ln, p.username as un, p.avatar_url as av, a.answers as ans, mp.rank_id as rk
    from public.ab_profiles a
    join public.profiles p on p.id = a.member_id
    join public.member_private mp on mp.member_id = a.member_id
    where a.member_id <> me and a.complete and a.pool_status = 'in_pool' and mp.rank_id is not null and public.is_active_affiliate(a.member_id)
  ), x as (
    select c.*, abs(c.rk - my_rank) as dist,
           abs(public.ab_offset(c.ans -> 'tz' ->> 'tz') - my_off) as tzd,
           case when jsonb_typeof(c.ans -> 'age') = 'number' then (c.ans ->> 'age')::numeric end as cage,
           public.ab_kids(c.ans -> 'kids') as ckids,
           public.ab_overlap(public.ab_arr(mine.answers -> 'goals'), public.ab_arr(c.ans -> 'goals')) as sg,
           public.ab_overlap(public.ab_arr(mine.answers -> 'interests'), public.ab_arr(c.ans -> 'interests')) as si,
           abs(coalesce(array_position(array['1-2 times a week','3-4 times a week','5-6 times a week','Daily'], c.ans ->> 'checkin'), 1)
               - coalesce(array_position(array['1-2 times a week','3-4 times a week','5-6 times a week','Daily'], mine.answers ->> 'checkin'), 1)) as cd
    from cand c
    where (case when (mine.answers ->> 'rankpref') = 'Yes, my rank only' or (c.ans ->> 'rankpref') = 'Yes, my rank only'
                then abs(c.rk - my_rank) = 0 else abs(c.rk - my_rank) <= 2 end)
      and not ((((mine.answers ->> 'samegender') = 'Yes, same gender') or ((c.ans ->> 'samegender') = 'Yes, same gender'))
               and (c.ans ->> 'gender') is distinct from (mine.answers ->> 'gender'))
  ), s as (
    select x.*,
      20 * greatest(0, 1 - x.tzd / 6)
      + 18 * (case when my_age is not null and x.cage is not null then greatest(0, 1 - greatest(0, abs(x.cage - my_age) - 3) / 17) else 0.5 end)
      + 18 * (case when my_kids is null or x.ckids is null then 0.5
                   when my_kids && x.ckids then 1
                   when x.ckids = array[0] or my_kids = array[0] then 0.2 else 0.55 end)
      + 10 * (case x.cd when 0 then 1 when 1 then 0.6 else 0.2 end)
      + 10 * least(1, cardinality(x.sg) / 1.5)
      + 8 * least(1, cardinality(x.si) / 3.0)
      + 6 * (case when (x.ans ->> 'chrono') = (mine.answers ->> 'chrono') then 1
                  when (x.ans ->> 'chrono') = 'It varies' or (mine.answers ->> 'chrono') = 'It varies' then 0.6 else 0 end)
      + 6 * (case when 'All of the above' = any (public.ab_arr(mine.answers -> 'style')) or 'All of the above' = any (public.ab_arr(x.ans -> 'style'))
                       or cardinality(public.ab_overlap(public.ab_arr(mine.answers -> 'style'), public.ab_arr(x.ans -> 'style'))) > 0 then 1 else 0.4 end)
      + 4 * (case when (x.ans ->> 'plan') = (mine.answers ->> 'plan') then 1 else 0.4 end) as raw
    from x
  ), r as (
    select s.*, row_number() over (partition by (s.tzd <= 6) order by s.raw desc, s.id) as rn from s
  )
  select r.id, r.fn, r.ln, r.un, r.av, round(r.raw)::integer,
         (array_remove(array[
            case when r.tzd = 0 then 'You are in the same timezone' when r.tzd <= 2 then 'Your timezones are only ' || r.tzd::integer || case when r.tzd::integer = 1 then ' hour' else ' hours' end || ' apart' end,
            case when my_kids is not null and r.ckids is not null and my_kids && r.ckids then case when r.ckids = array[0] then 'You both have a life without kids at home' else 'You are both juggling business and family' end end,
            case when my_age is not null and r.cage is not null and abs(r.cage - my_age) <= 4 then 'You are at a similar stage of life' end,
            case when cardinality(r.sg) > 0 then 'You share a goal: ' || lower(r.sg[1]) end,
            case when cardinality(r.si) > 0 then 'You share an interest in ' || lower(array_to_string(r.si[1:2], ' and ')) end,
            case when (r.ans ->> 'chrono') = (mine.answers ->> 'chrono') and (r.ans ->> 'chrono') <> 'It varies'
                 then 'You are both ' || case r.ans ->> 'chrono' when 'Night owl' then 'night owls' when 'Early bird' then 'early birds' else 'midday people' end end,
            case when (r.ans ->> 'checkin') = (mine.answers ->> 'checkin') then 'You want the same check-in rhythm' end
          ], null))[1:3],
         (r.tzd <= 6 and r.rn <= 5)
  from r
  order by (r.tzd <= 6 and r.rn <= 5) desc, r.raw desc;
end $$;
revoke all on function public.ab_matches_for(uuid) from public, anon, authenticated;

-- the version members call: always about themselves
create or replace function public.ab_matches_for_me() returns table (member_id uuid, first_name text, last_name text, username citext, avatar_url text, score integer, reasons text[], is_top boolean)
language sql stable security definer set search_path = public, pg_temp
as $$ select * from public.ab_matches_for(auth.uid()) where auth.uid() is not null $$;

-- who has already been told about whom, so nobody is told twice
create table public.ab_notified (
  member_id    uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (member_id, candidate_id)
);
alter table public.ab_notified enable row level security;

create function public.ab_notify_new_candidate() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare m record; nm text;
begin
  select coalesce(first_name || ' ' || last_name, 'Someone') into nm from public.profiles where id = new.member_id;
  for m in select a.member_id from public.ab_profiles a where a.member_id <> new.member_id and a.complete and a.pool_status = 'in_pool'
           and not exists (select 1 from public.ab_notified n where n.member_id = a.member_id and n.candidate_id = new.member_id)
  loop
    if exists (select 1 from public.ab_matches_for(m.member_id) x where x.member_id = new.member_id and x.is_top) then
      insert into public.ab_notified (member_id, candidate_id) values (m.member_id, new.member_id) on conflict do nothing;
      perform public.notify_user(m.member_id, 'accountability', 'You have a new Accountability Buddy match!', nm || ' is now in your top 5 matches.', '/buddy');
    end if;
  end loop;
  return null;
end $$;

create trigger ab_profiles_new_candidate after insert or update on public.ab_profiles
  for each row when (new.complete and new.pool_status = 'in_pool') execute function public.ab_notify_new_candidate();
