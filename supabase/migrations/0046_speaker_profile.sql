-- Clicking a speaker on a call: find the community member with that name (if there is one) so their profile can show.
-- Affiliates get the full profile bubble; a lead only gets the name and picture. No match means a guest speaker.
create or replace function public.speaker_profile(p_name text)
returns table (found boolean, viewer_is_member boolean, id uuid, first_name text, last_name text, username citext, avatar_url text, instagram text, facebook text, is_admin boolean,
               birth_month smallint, birth_day smallint, birth_year smallint, call_closer boolean, offers_services boolean)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare me_member boolean := public.app_current_role() in ('member', 'admin'); n integer; p public.profiles;
begin
  if auth.uid() is null then return; end if;
  select count(*) into n from public.profiles x
    where lower(btrim(coalesce(x.first_name, '') || ' ' || coalesce(x.last_name, ''))) = lower(btrim(p_name))
      and x.role in ('member', 'admin') and x.onboarded_at is not null and x.removed_at is null;
  if n <> 1 then
    return query select false, me_member, null::uuid, null::text, null::text, null::citext, null::text, null::text, null::text, false, null::smallint, null::smallint, null::smallint, false, false;
    return;
  end if;
  select * into p from public.profiles x
    where lower(btrim(coalesce(x.first_name, '') || ' ' || coalesce(x.last_name, ''))) = lower(btrim(p_name))
      and x.role in ('member', 'admin') and x.onboarded_at is not null and x.removed_at is null;
  if me_member then
    return query select true, true, p.id, p.first_name, p.last_name, p.username, p.avatar_url, p.instagram, p.facebook, p.role = 'admin', p.birth_month, p.birth_day, p.birth_year, p.call_closer,
      exists (select 1 from public.outsourcing_profiles o where o.member_id = p.id and o.listed and public.is_active_affiliate(p.id));
  else
    return query select true, false, p.id, p.first_name, p.last_name, null::citext, p.avatar_url, null::text, null::text, false, null::smallint, null::smallint, null::smallint, false, false;
  end if;
end $$;
revoke all on function public.speaker_profile(text) from public, anon;
grant execute on function public.speaker_profile(text) to authenticated;
