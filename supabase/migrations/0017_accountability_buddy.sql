-- Accountability Buddy: questionnaire answers, who is in the matching pool, matching that only ever returns safe fields, and chosen pairs.
-- Rank lives in member_private.rank_id (the same rank as on the Profile page). Rank, age and gender are never returned to anyone else.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing', 'accountability'));

create table public.ab_profiles (
  member_id         uuid primary key references public.profiles (id) on delete cascade,
  answers           jsonb not null default '{}'::jsonb,
  complete          boolean not null default false,
  pool_status       text check (pool_status in ('in_pool', 'paused', 'has_ab', 'matched')),
  in_pool_since     timestamptz,
  rank_confirmed_at timestamptz,
  updated_at        timestamptz not null default now()
);
alter table public.ab_profiles enable row level security;
create policy ab_own_read on public.ab_profiles for select to authenticated using (member_id = auth.uid());
-- all writes go through the functions below

create table public.ab_matches (
  id         uuid primary key default gen_random_uuid(),
  chooser_id uuid not null references public.profiles (id) on delete cascade,
  chosen_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (chooser_id <> chosen_id)
);
alter table public.ab_matches enable row level security;
create policy abm_own_read on public.ab_matches for select to authenticated using (chooser_id = auth.uid() or chosen_id = auth.uid());

create function public.ab_keys() returns text[] language sql immutable as $$
  select array['tz','chrono','checkin','connect','gender','age','kids','samegender','joined','ordered','rank','rankpref','goals','success','derail','want','style','recharge','decide','plan','friends','interests','weekend','values','about','working'] $$;

-- Save answers as the member goes. When every question has an answer and a rank is set, they join the pool.
create function public.ab_save(p_answers jsonb, p_rank smallint) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare done boolean; k text; row public.ab_profiles;
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'members only' using errcode = '42501'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'bad answers' using errcode = '22023'; end if;
  if p_rank is not null then
    insert into public.member_private (member_id, rank_id) values (auth.uid(), p_rank)
      on conflict (member_id) do update set rank_id = excluded.rank_id, updated_at = now();
  end if;
  done := coalesce((select rank_id is not null from public.member_private where member_id = auth.uid()), false);
  foreach k in array public.ab_keys() loop
    if p_answers -> k is null or p_answers -> k = 'null'::jsonb then done := false; end if;
  end loop;
  insert into public.ab_profiles (member_id, answers, complete) values (auth.uid(), p_answers, done)
    on conflict (member_id) do update set answers = excluded.answers, complete = excluded.complete, updated_at = now()
    returning * into row;
  if done and row.pool_status is null then
    update public.ab_profiles set pool_status = 'in_pool', in_pool_since = now(), rank_confirmed_at = now() where member_id = auth.uid();
  end if;
  return jsonb_build_object('complete', done);
end $$;
revoke all on function public.ab_save(jsonb, smallint) from public, anon;
grant execute on function public.ab_save(jsonb, smallint) to authenticated;

-- Leave or rejoin the pool ("not looking", "I already have an AB", "find a new AB").
create function public.ab_set_status(p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'members only' using errcode = '42501'; end if;
  if p_status not in ('in_pool', 'paused', 'has_ab') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.ab_profiles set pool_status = p_status, in_pool_since = case when p_status = 'in_pool' then now() else in_pool_since end,
         updated_at = now() where member_id = auth.uid() and complete;
end $$;
revoke all on function public.ab_set_status(text) from public, anon;
grant execute on function public.ab_set_status(text) to authenticated;

-- "Are you still a 4A?": any answer saves the rank, restarts the clock and puts them back in the pool.
create function public.ab_confirm_rank(p_rank smallint) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'members only' using errcode = '42501'; end if;
  insert into public.member_private (member_id, rank_id) values (auth.uid(), p_rank)
    on conflict (member_id) do update set rank_id = excluded.rank_id, updated_at = now();
  update public.ab_profiles set rank_confirmed_at = now(), pool_status = 'in_pool', in_pool_since = now(), updated_at = now() where member_id = auth.uid() and complete;
end $$;
revoke all on function public.ab_confirm_rank(smallint) from public, anon;
grant execute on function public.ab_confirm_rank(smallint) to authenticated;

-- ---------------------------------------------------------------- matching helpers
create function public.ab_arr(j jsonb) returns text[] language sql immutable as $$
  select case when jsonb_typeof(j) = 'array' then array(select jsonb_array_elements_text(j)) else '{}'::text[] end $$;
create function public.ab_offset(tz text) returns numeric language plpgsql stable as $$
begin
  return extract(epoch from (now() at time zone tz) - (now() at time zone 'UTC')) / 3600;
exception when others then return 0;
end $$;
-- kids answers as numbers (0 none, 1 under 5, 2 five to 12, 3 teens, 4 adult); null when not answered
create function public.ab_kids(j jsonb) returns integer[] language sql immutable as $$
  select case when 'Prefer not to answer' = any (public.ab_arr(j)) or cardinality(public.ab_arr(j)) = 0 then null
    else array(select case k when 'No kids' then 0 when 'I have kids ages 4 and under' then 1 when 'I have kids ages 5-12' then 2 when 'I have teenagers' then 3 else 4 end
               from unnest(public.ab_arr(j)) k) end $$;
create function public.ab_overlap(a text[], b text[]) returns text[] language sql immutable as $$
  select array(select x from unnest(a) x where x = any (b)) $$;

-- Matching. Returns ONLY who matched, a percentage and plain-language reasons. Rank, age and gender are used here and never leave this function.
create function public.ab_matches_for_me() returns table (member_id uuid, first_name text, last_name text, username citext, avatar_url text, score integer, reasons text[], is_top boolean)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); mine record; my_off numeric; my_rank smallint; my_kids integer[]; my_age numeric;
begin
  if me is null or not public.can_see('member') then return; end if;
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
revoke all on function public.ab_matches_for_me() from public, anon;
grant execute on function public.ab_matches_for_me() to authenticated;

-- Choose someone as your accountability buddy: both leave the pool, and they are told.
create function public.ab_choose(p_other uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare nm text;
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'members only' using errcode = '42501'; end if;
  if not exists (select 1 from public.ab_matches_for_me() m where m.member_id = p_other) then
    return jsonb_build_object('ok', false, 'reason', 'That person is no longer available.');
  end if;
  insert into public.ab_matches (chooser_id, chosen_id) values (auth.uid(), p_other);
  update public.ab_profiles set pool_status = 'matched', updated_at = now() where member_id in (auth.uid(), p_other);
  select coalesce(first_name || ' ' || last_name, 'Someone') into nm from public.profiles where id = auth.uid();
  perform public.notify_user(p_other, 'accountability', nm || ' chose you as their accountability buddy!', 'Say hello and set up your first check-in.',
    '/messages/' || (select username from public.profiles where id = auth.uid()));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.ab_choose(uuid) from public, anon;
grant execute on function public.ab_choose(uuid) to authenticated;

-- who is my buddy now (if any)
create function public.ab_my_buddy() returns table (member_id uuid, first_name text, last_name text, username citext, avatar_url text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url
  from (select case when chooser_id = auth.uid() then chosen_id else chooser_id end as other, created_at
        from public.ab_matches where chooser_id = auth.uid() or chosen_id = auth.uid() order by created_at desc limit 1) m
  join public.profiles p on p.id = m.other
$$;
revoke all on function public.ab_my_buddy() from public, anon;
grant execute on function public.ab_my_buddy() to authenticated;
