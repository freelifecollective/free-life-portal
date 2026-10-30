-- Speakers chosen from the FLC Member list are linked to that member, so clicking them shows their profile.
-- A speaker typed in by hand (a guest) has no link and shows as "Guest Speaker".
alter table public.call_speakers add column if not exists member_id uuid references public.profiles (id) on delete set null;

-- speakers already on calls: link those whose name is exactly one community member's name
update public.call_speakers cs set member_id = (
  select p.id from public.profiles p
  where lower(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) = lower(btrim(cs.name))
    and p.role in ('member', 'admin') and p.onboarded_at is not null and p.removed_at is null
) where cs.member_id is null and (
  select count(*) from public.profiles p
  where lower(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) = lower(btrim(cs.name))
    and p.role in ('member', 'admin') and p.onboarded_at is not null and p.removed_at is null
) = 1;

-- "charge per product sale" is free text now (for example "20% of the sale")
alter table public.call_closer_details add column if not exists price_per_sale text check (price_per_sale is null or char_length(price_per_sale) <= 120);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'call_closer_details' and column_name = 'price_per_sale_cents') then
    update public.call_closer_details set price_per_sale = '$' || trim_scale(round(price_per_sale_cents / 100.0, 2))::text where price_per_sale_cents is not null and price_per_sale is null;
    alter table public.call_closer_details drop column price_per_sale_cents;
  end if;
end $$;

-- the speaker's profile, looked up by the linked member
drop function if exists public.speaker_profile(text);
create or replace function public.speaker_profile(p_id uuid)
returns table (found boolean, viewer_is_member boolean, id uuid, first_name text, last_name text, username citext, avatar_url text, instagram text, facebook text, is_admin boolean,
               birth_month smallint, birth_day smallint, birth_year smallint, call_closer boolean, offers_services boolean)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare me_member boolean := public.app_current_role() in ('member', 'admin'); p public.profiles;
begin
  if auth.uid() is null then return; end if;
  select * into p from public.profiles x where x.id = p_id and x.role in ('member', 'admin') and x.onboarded_at is not null and x.removed_at is null;
  if p.id is null then
    return query select false, me_member, null::uuid, null::text, null::text, null::citext, null::text, null::text, null::text, false, null::smallint, null::smallint, null::smallint, false, false;
    return;
  end if;
  if me_member then
    return query select true, true, p.id, p.first_name, p.last_name, p.username, p.avatar_url, p.instagram, p.facebook, p.role = 'admin', p.birth_month, p.birth_day, p.birth_year, p.call_closer,
      exists (select 1 from public.outsourcing_profiles o where o.member_id = p.id and o.listed and public.is_active_affiliate(p.id));
  else
    return query select true, false, p.id, p.first_name, p.last_name, null::citext, p.avatar_url, null::text, null::text, false, null::smallint, null::smallint, null::smallint, false, false;
  end if;
end $$;
revoke all on function public.speaker_profile(uuid) from public, anon;
grant execute on function public.speaker_profile(uuid) to authenticated;
