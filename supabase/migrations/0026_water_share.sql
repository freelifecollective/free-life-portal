-- Water Share Map: affiliates who are willing to share water with other members' leads.
-- Only a nearby (not exact) point is stored, as coordinates plus a town-level label.
create table public.water_share (
  member_id  uuid primary key references public.profiles (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  place      text not null check (char_length(btrim(place)) between 1 and 160),
  prefilter  boolean not null,
  water_type text not null check (water_type in ('city', 'well')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.water_share enable row level security;
create policy ws_read_own on public.water_share for select to authenticated using (member_id = auth.uid());
create policy ws_insert on public.water_share for insert to authenticated with check (member_id = auth.uid() and public.can_see('member'));
create policy ws_update on public.water_share for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid() and public.can_see('member'));
create policy ws_delete on public.water_share for delete to authenticated using (member_id = auth.uid() or public.is_admin());
create trigger water_share_touch before update on public.water_share for each row execute function public.touch_updated_at();

-- Whether a member has answered "Would you like to add yourself?" (yes or no), so the question is asked once.
create table public.water_share_asked (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  asked_at  timestamptz not null default now()
);
alter table public.water_share_asked enable row level security;
create policy wsa_read on public.water_share_asked for select to authenticated using (member_id = auth.uid());
create policy wsa_insert on public.water_share_asked for insert to authenticated with check (member_id = auth.uid() and public.can_see('member'));
create policy wsa_delete on public.water_share_asked for delete to authenticated using (member_id = auth.uid());

-- Everyone on the map, for affiliates only. A member leaves the map when removed or after six unpaid months,
-- and returns by themselves if they are in good standing again. Rank comes from the member's private settings.
create function public.water_share_map() returns table (
  member_id uuid, first_name text, last_name text, username text, avatar_url text, rank text,
  place text, lat double precision, lng double precision, prefilter boolean, water_type text)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.member_id, p.first_name, p.last_name, p.username::text, p.avatar_url, r.name,
         w.place, w.lat, w.lng, w.prefilter, w.water_type
    from public.water_share w
    join public.profiles p on p.id = w.member_id
    left join public.member_private mp on mp.member_id = w.member_id
    left join public.ranks r on r.id = mp.rank_id
   where public.can_see('member')
     and p.onboarded_at is not null and p.removed_at is null and p.role in ('member', 'admin')
     and (p.unpaid_since is null or p.unpaid_since > (current_date - interval '6 months')::date)
   order by p.first_name, p.last_name
$$;
revoke all on function public.water_share_map() from public, anon;
grant execute on function public.water_share_map() to authenticated;
