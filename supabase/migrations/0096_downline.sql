-- Lacey's Downline: sees all documents switched on for them, the Water Share Map (and can add themselves), the Main Discussion chat,
-- and the calendar and RSVP for calls marked "Open to Lacey's Downline". Nothing else.

-- a downline account sits below leads: it passes none of the lead or affiliate checks
create or replace function public.role_rank(r public.app_role) returns integer
language sql immutable parallel safe
as $$ select case r when 'downline' then 0 when 'lead' then 1 when 'member' then 2 when 'admin' then 3 end $$;

-- "downline" as the lowest role a thing needs means: the downline and affiliates, but not leads. Everything else compares as before.
create or replace function public.role_allows(r public.app_role, need public.app_role) returns boolean
language sql immutable parallel safe
as $$ select case when need = 'downline' then r in ('downline', 'member', 'admin') else public.role_rank(r) >= public.role_rank(need) end $$;

create or replace function public.can_see(min_role public.app_role) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(public.role_allows(public.app_current_role(), min_role), false) $$;

-- every function that compared roles by rank itself now goes through role_allows
do $$
declare f record; def text; fixed text;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname not in ('role_allows', 'can_see', 'role_rank')
       and pg_get_functiondef(p.oid) ~ 'public\.role_rank\([a-z_.]+\) >= public\.role_rank\([a-z_.]+\)'
  loop
    def := pg_get_functiondef(f.oid);
    fixed := regexp_replace(def, 'public\.role_rank\(([a-z_.]+)\) >= public\.role_rank\(([a-z_.]+)\)', 'public.role_allows(\1, \2)', 'g');
    execute fixed;
  end loop;
end $$;

-- ---------------------------------------------------------------- calls: a third audience
drop policy if exists calls_read on public.calls;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'calls' and cmd = 'SELECT' and qual like '%leads_open%' loop
    execute format('drop policy %I on public.calls', pol.policyname);
  end loop;
end $$;
create policy calls_read on public.calls for select to authenticated using (
  public.can_see('member')
  or (audience = 'leads_open' and public.can_see('lead'))
  or (audience = 'downline_open' and public.app_current_role() = 'downline'));

-- every function that decided who could see a call
do $$
declare f record; def text; fixed text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and pg_get_functiondef(p.oid) ~ '\(([a-z]+\.)?audience = ''leads_open'' and public\.can_see\(''lead''\)\)'
  loop
    def := pg_get_functiondef(f.oid);
    fixed := regexp_replace(def, '\(([a-z]+\.)?audience = ''leads_open'' and public\.can_see\(''lead''\)\)',
      '(\1audience = ''leads_open'' and public.can_see(''lead'')) or (\1audience = ''downline_open'' and public.app_current_role() = ''downline'')', 'g');
    execute fixed;
  end loop;
  -- who is told about a new call
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'call_audience_users' loop
    def := pg_get_functiondef(f.oid);
    fixed := replace(def, '(c.audience = ''leads_open'' or p.role in (''member'', ''admin''))',
      '(case c.audience when ''leads_open'' then p.role <> ''downline'' when ''downline_open'' then p.role in (''downline'', ''member'', ''admin'') else p.role in (''member'', ''admin'') end)');
    execute fixed;
  end loop;
end $$;

-- ---------------------------------------------------------------- documents
create or replace function public.doc_folder_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  with recursive up as (
    select id, parent_id, for_leads, for_downline, 1 as depth from public.doc_folders where id = p_id
    union all
    select f.id, f.parent_id, f.for_leads, f.for_downline, up.depth + 1 from public.doc_folders f join up on f.id = up.parent_id where up.depth < 25
  )
  select case
    when auth.uid() is null then false
    when p_id is null then true
    when public.can_see('member') then exists (select 1 from up)
    when public.app_current_role() = 'lead' then coalesce((select bool_and(for_leads) from up), false)
    when public.app_current_role() = 'downline' then coalesce((select bool_and(for_downline) from up), false)
    else false end
$$;
create or replace function public.doc_file_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select case when public.can_see('member') then true
                               when public.app_current_role() = 'lead' then f.for_leads and public.doc_folder_visible(f.folder_id)
                               when public.app_current_role() = 'downline' then f.for_downline and public.doc_folder_visible(f.folder_id)
                               else false end
                   from public.doc_files f where f.id = p_id), false)
$$;

-- ---------------------------------------------------------------- Main Discussion
insert into public.chat_sections (id, name, sort, min_role)
  select coalesce(max(id), 0) + 1, 'Main Discussion', 0, 'downline' from public.chat_sections
  where not exists (select 1 from public.chat_sections where name = 'Main Discussion');
insert into public.chats (section_id, slug, name, description, sort, min_role, posting, mode)
  select s.id, 'main-discussion', 'Main Discussion', 'Where Lacey''s downline and the FLC affiliates talk together.', 1, 'downline', 'all', 'conversation'
    from public.chat_sections s where s.name = 'Main Discussion'
  on conflict (slug) do nothing;

-- the chat list: the downline sees only their own chat; leads never see it
drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select to authenticated using (
  case when public.app_current_role() = 'downline' then min_role = 'downline'
       else min_role <> 'downline' or public.can_see('downline') end);

drop policy if exists chat_sections_read on public.chat_sections;
create policy chat_sections_read on public.chat_sections for select to authenticated using (
  case when public.app_current_role() = 'downline' then min_role = 'downline'
       else min_role <> 'downline' or public.can_see('downline') end);

-- ---------------------------------------------------------------- Water Share Map: the downline can add themselves
drop policy if exists wsa_insert on public.water_share_asked;
create policy wsa_insert on public.water_share_asked for insert to authenticated with check (member_id = auth.uid() and (public.can_see('member') or public.app_current_role() = 'downline'));
drop policy if exists ws_insert on public.water_share;
create policy ws_insert on public.water_share for insert to authenticated with check (member_id = auth.uid() and (public.can_see('member') or public.app_current_role() = 'downline'));
drop policy if exists ws_update on public.water_share;
create policy ws_update on public.water_share for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid() and (public.can_see('member') or public.app_current_role() = 'downline'));
create or replace function public.water_share_map() returns table (
  member_id uuid, first_name text, last_name text, username text, avatar_url text, rank text,
  place text, lat double precision, lng double precision, prefilter boolean, water_type text)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.member_id, p.first_name, p.last_name, p.username::text, p.avatar_url, case when p.role = 'downline' then null else r.name end,
         w.place, w.lat, w.lng, w.prefilter, w.water_type
    from public.water_share w
    join public.profiles p on p.id = w.member_id
    left join public.member_private mp on mp.member_id = w.member_id
    left join public.ranks r on r.id = mp.rank_id
   where (public.can_see('member') or public.app_current_role() = 'downline')
     and p.onboarded_at is not null and p.removed_at is null and p.role in ('member', 'admin', 'downline')
     and (p.unpaid_since is null or p.unpaid_since > (current_date - interval '6 months')::date)
   order by p.first_name, p.last_name
$$;

-- ---------------------------------------------------------------- no direct messages for the downline (and nobody writes to them)
create or replace function public.can_message(p_recipient uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles r where r.id = p_recipient and r.onboarded_at is not null and r.id <> auth.uid()
                 and public.app_current_role() <> 'downline' and r.role <> 'downline'
                 and (public.app_current_role() <> 'lead' or r.role <> 'lead'))
$$;

-- ---------------------------------------------------------------- the public sign-up page for Lacey's downline
-- Anyone can ask for an account. Paying FLC members are told they are already in. Rate limited.
create or replace function public.downline_signup(p_email text) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare em text := lower(btrim(coalesce(p_email, '')));
begin
  if em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or char_length(em) > 254 then return 'bad'; end if;
  if exists (select 1 from public.profiles where email = em::citext and role in ('member', 'admin'))
     or exists (select 1 from public.signup_allowlist where email = em::citext and role = 'member') then return 'member'; end if;
  if (select count(*) from public.signup_allowlist where note = 'Lacey''s downline sign-up' and created_at > now() - interval '1 hour') >= 300 then return 'busy'; end if;
  insert into public.signup_allowlist (email, role, note) values (em, 'downline', 'Lacey''s downline sign-up') on conflict (email) do nothing;
  return 'ok';
end $$;
revoke all on function public.downline_signup(text) from public;
grant execute on function public.downline_signup(text) to anon, authenticated;
notify pgrst, 'reload schema';
