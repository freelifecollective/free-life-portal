-- Lets a picture or name in "who is coming / who attended" open that person's profile: the lists now carry each person's id.
create or replace function public.call_rsvp_summary(p_call uuid, p_limit integer default 12) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare visible boolean; live_n integer; rec_n integer; mine public.rsvp_mode; people jsonb;
begin
  select exists (select 1 from public.calls c where c.id = p_call
    and (public.can_see('member') or (c.audience = 'leads_open' and public.can_see('lead')))) into visible;
  if not visible then return null; end if;
  select count(*) filter (where mode = 'live'), count(*) filter (where mode = 'recording') into live_n, rec_n from public.rsvps where call_id = p_call;
  select mode into mine from public.rsvps where call_id = p_call and user_id = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', coalesce(pr.first_name, ''), 'username', pr.username, 'avatar_url', pr.avatar_url, 'mode', r.mode) order by r.created_at), '[]'::jsonb)
    into people
    from (select * from public.rsvps where call_id = p_call order by created_at limit greatest(least(coalesce(p_limit, 12), 50), 0)) r
    join public.profiles pr on pr.id = r.user_id where pr.onboarded_at is not null;
  return jsonb_build_object('live', live_n, 'recording', rec_n, 'mine', mine, 'people', people);
end $$;

create or replace function public.call_attendance_summary(p_call uuid, p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare visible boolean; n integer; people jsonb;
begin
  select exists (select 1 from public.calls c where c.id = p_call
    and (public.can_see('member') or (c.audience = 'leads_open' and public.can_see('lead')))) into visible;
  if not visible then return null; end if;
  select count(*)::integer into n from public.call_attendance where call_id = p_call;
  select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', coalesce(pr.first_name, ''), 'username', pr.username, 'avatar_url', pr.avatar_url, 'mode', 'live') order by a.joined_at), '[]'::jsonb)
    into people
    from (select * from public.call_attendance where call_id = p_call order by joined_at limit greatest(least(coalesce(p_limit, 50), 100), 0)) a
    join public.profiles pr on pr.id = a.user_id where pr.onboarded_at is not null;
  return jsonb_build_object('count', n, 'people', people);
end $$;

-- Feedback from other attendees also carries each person's id, so their picture and name can open their profile.
drop function if exists public.call_feedback_all(uuid);
create function public.call_feedback_all(p_call uuid) returns table (member_id uuid, first_name text, last_name text, avatar_url text, thoughts text, favourite text, takeaway text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.avatar_url, f.thoughts, f.favourite, f.takeaway, f.created_at
  from public.call_feedback f join public.profiles p on p.id = f.user_id
  where f.call_id = p_call
    and (public.is_admin() or exists (select 1 from public.call_feedback mine where mine.call_id = p_call and mine.user_id = auth.uid()))
  order by f.created_at desc
$$;
revoke all on function public.call_feedback_all(uuid) from public, anon;
grant execute on function public.call_feedback_all(uuid) to authenticated;

notify pgrst, 'reload schema';
