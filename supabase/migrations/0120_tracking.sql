-- Tracking: a Trello-style lead board for each affiliate, and a list of their team with check-ins.
alter table public.member_prefs add column if not exists lead_boards_seeded boolean not null default false;

create table public.lead_boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  kind       text check (kind in ('leads', 'portal')),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.lead_lists (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.lead_boards (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  name     text not null check (char_length(btrim(name)) between 1 and 80),
  kind     text check (kind in ('registered')),
  position integer not null default 0
);
create table public.lead_cards (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lead_lists (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  email         text check (email is null or char_length(email) <= 254),
  phone         text check (phone is null or char_length(phone) <= 40),
  note          text check (note is null or char_length(note) <= 1000),
  position      integer not null default 0,
  affiliated_at timestamptz,
  created_at    timestamptz not null default now()
);
create index lead_lists_board on public.lead_lists (board_id, position);
create index lead_cards_list on public.lead_cards (list_id, position);
create index lead_boards_user on public.lead_boards (user_id, position);

create table public.team_members (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  email               text check (email is null or char_length(email) <= 254),
  rank                text not null default 'New' check (char_length(rank) between 1 and 20),
  linked_profile      uuid references public.profiles (id) on delete set null,
  status_override     text check (status_override in ('left', 'inactive')),
  last_check_in_at    timestamptz,
  last_check_in_note  text check (last_check_in_note is null or char_length(last_check_in_note) <= 200),
  created_at          timestamptz not null default now()
);
create table public.team_checks (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  label     text not null check (char_length(btrim(label)) between 1 and 200),
  kind      text not null default 'manual' check (kind in ('manual', 'graphic', 'welcome_chat', 'team_chat', 'course_started', 'course_half', 'course_done')),
  done      boolean not null default false,
  done_at   timestamptz,
  position  integer not null default 0
);
create index team_members_user on public.team_members (user_id);
create index team_checks_member on public.team_checks (member_id, position);

do $$ declare t text;
begin
  foreach t in array array['lead_boards', 'lead_lists', 'lead_cards', 'team_members', 'team_checks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid() and public.can_see(''member'')) with check (user_id = auth.uid() and public.can_see(''member''))', t || '_own', t);
  end loop;
end $$;

-- the two starter boards (made once, the first time someone opens Lead Tracking; they can edit or delete everything)
create or replace function public.make_default_boards(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare b uuid; n text; i integer;
begin
  insert into public.lead_boards (user_id, name, kind, position) values (p_user, 'New Leads', 'leads', 0) returning id into b;
  i := 0;
  foreach n in array array['New Lead', 'Follow Up Set', 'Follow Up Due', 'Portal Invitation Sent', 'Circle Back in 60 Days', 'Ghosted (Circle Back in 90 Days)', 'Said No/Not Interested'] loop
    insert into public.lead_lists (board_id, user_id, name, position) values (b, p_user, n, i); i := i + 1;
  end loop;
  insert into public.lead_boards (user_id, name, kind, position) values (p_user, 'Leads in the FLC Portal', 'portal', 1) returning id into b;
  i := 0;
  foreach n in array array['Registered for the Portal', 'Follow Up Set', 'Follow Up Due', 'Coaching Call Booked', 'Coaching Call Complete', 'Quote Sent', 'Purchase Link/Forms Sent'] loop
    insert into public.lead_lists (board_id, user_id, name, kind, position) values (b, p_user, n, case when i = 0 then 'registered' end, i); i := i + 1;
  end loop;
end $$;
revoke all on function public.make_default_boards(uuid) from public, anon, authenticated;

create or replace function public.ensure_lead_boards() returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare done boolean;
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  select m.lead_boards_seeded into done from public.member_prefs m where m.member_id = auth.uid();
  if coalesce(done, false) then return; end if;
  perform public.make_default_boards(auth.uid());
  insert into public.member_prefs (member_id, lead_boards_seeded) values (auth.uid(), true)
  on conflict (member_id) do update set lead_boards_seeded = true;
end $$;
revoke all on function public.ensure_lead_boards() from public, anon;
grant execute on function public.ensure_lead_boards() to authenticated;

-- "Registered for the Portal": the card moves to that list on the "Leads in the FLC Portal" board (the board and list are made again if they were deleted)
create or replace function public.lead_register_in_portal(p_card uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); b uuid; l uuid; pos integer;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if not exists (select 1 from public.lead_cards c where c.id = p_card and c.user_id = me) then raise exception 'not your card' using errcode = '42501'; end if;
  select id into b from public.lead_boards where user_id = me and kind = 'portal' order by position limit 1;
  if b is null then
    insert into public.lead_boards (user_id, name, kind, position) values (me, 'Leads in the FLC Portal', 'portal', coalesce((select max(position) + 1 from public.lead_boards where user_id = me), 0)) returning id into b;
  end if;
  select id into l from public.lead_lists where board_id = b and kind = 'registered' limit 1;
  if l is null then select id into l from public.lead_lists where board_id = b and lower(name) = 'registered for the portal' limit 1; end if;
  if l is null then
    insert into public.lead_lists (board_id, user_id, name, kind, position) values (b, me, 'Registered for the Portal', 'registered', coalesce((select min(position) - 1 from public.lead_lists where board_id = b), 0)) returning id into l;
  end if;
  select coalesce(max(position) + 1, 0) into pos from public.lead_cards where list_id = l;
  update public.lead_cards set list_id = l, position = pos where id = p_card;
  return b;
end $$;
revoke all on function public.lead_register_in_portal(uuid) from public, anon;
grant execute on function public.lead_register_in_portal(uuid) to authenticated;

-- the check-in list every new team member starts with (they can add their own)
create or replace function public.make_team_checks(p_member uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare i integer := 0; r record;
begin
  for r in select * from (values
    ('Created a congratulations graphic for affiliating with the Graphic Maker', 'graphic'),
    ('Congratulated them for starting their business in the New Members Discussion Chat', 'welcome_chat'),
    ('Congratulated them in my team chat', 'team_chat'),
    ('Followed them on social media', 'manual'),
    ('Let them know their next steps for getting their business started', 'manual'),
    ('Showed them where to find their landing page and invite link', 'manual'),
    ('Introduced them to an accountability buddy', 'manual'),
    ('Helped them set their first weekly goals', 'manual'),
    ('Booked our first check-in call', 'manual'),
    ('Invited them to the live calls', 'manual'),
    ('They started the Business Launch Course', 'course_started'),
    ('They completed 50% of the Business Launch Course', 'course_half'),
    ('They finished the Business Launch Course', 'course_done')
  ) as v(label, kind) loop
    insert into public.team_checks (member_id, user_id, label, kind, position) values (p_member, p_user, r.label, r.kind, i); i := i + 1;
  end loop;
end $$;
revoke all on function public.make_team_checks(uuid, uuid) from public, anon, authenticated;

-- "Affiliated": the card becomes a team member (linked to their portal account when their email matches one) and leaves the board
create or replace function public.lead_affiliated(p_card uuid, p_rank text default 'New') returns uuid
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
    insert into public.team_members (user_id, name, email, rank, linked_profile) values (me, c.name, nullif(btrim(coalesce(c.email, '')), ''), coalesce(nullif(btrim(p_rank), ''), 'New'), link) returning id into t;
    perform public.make_team_checks(t, me);
  end if;
  update public.lead_cards set affiliated_at = now() where id = p_card;
  return t;
end $$;
revoke all on function public.lead_affiliated(uuid, text) from public, anon;
grant execute on function public.lead_affiliated(uuid, text) to authenticated;

-- the team, with whether each is active in FLC and how far they are in the Business Launch Course (read from their own account)
create or replace function public.my_team_overview()
returns table (id uuid, name text, email text, rank text, status text, last_check_in_at timestamptz, last_check_in_note text, started boolean, done_lessons integer, total_lessons integer)
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
         coalesce(d.n, 0) > 0, coalesce(d.n, 0), (select n from total)
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
