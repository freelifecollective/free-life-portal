-- Courses: choose who can see each one with three tick boxes: FLC Members, Lacey's Downline, Leads (any mix).
alter table public.classroom_courses add column if not exists for_members boolean not null default true;
alter table public.classroom_courses add column if not exists for_downline boolean not null default false;
alter table public.classroom_courses add column if not exists for_leads boolean not null default false;

-- courses that were "Everyone, including leads" keep showing to members and leads; "Affiliates only" ones to members
update public.classroom_courses set for_members = true, for_leads = (audience = 'everyone');

-- the old audience column follows the boxes (and an old-style insert of 'everyone' still turns Leads on)
create or replace function public.classroom_course_audience() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.audience = 'everyone' then new.for_leads := true; end if;
  new.audience := case when new.for_leads then 'everyone' else 'affiliates' end;
  return new;
end $$;
drop trigger if exists classroom_course_audience on public.classroom_courses;
create trigger classroom_course_audience before insert or update on public.classroom_courses for each row execute function public.classroom_course_audience();

create or replace function public.classroom_can_see(p_course uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classroom_courses c
     where c.id = p_course
       and (public.is_admin() or (c.published and (
             (c.for_members and public.app_current_role() in ('member', 'admin'))
          or (c.for_downline and public.app_current_role() = 'downline')
          or (c.for_leads and public.app_current_role() = 'lead'))))
  )
$$;
revoke all on function public.classroom_can_see(uuid) from public, anon;
grant execute on function public.classroom_can_see(uuid) to authenticated;

drop function if exists public.classroom_overview();
create or replace function public.classroom_overview()
returns table (id uuid, title text, description text, audience text, published boolean, lessons integer, done integer, sort integer, cover_url text, for_members boolean, for_downline boolean, for_leads boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, c.title, c.description, c.audience, c.published,
         (select count(*)::int from public.classroom_lessons l where l.course_id = c.id and l.published),
         (select count(*)::int from public.classroom_progress p join public.classroom_lessons l on l.id = p.lesson_id where p.user_id = auth.uid() and l.course_id = c.id and l.published),
         c.sort, c.cover_url, c.for_members, c.for_downline, c.for_leads
    from public.classroom_courses c
   where public.classroom_can_see(c.id) and (c.published or public.is_admin())
   order by c.sort, c.created_at
$$;
revoke all on function public.classroom_overview() from public, anon;
grant execute on function public.classroom_overview() to authenticated;
notify pgrst, 'reload schema';
