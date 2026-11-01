-- Phase 101: a cover photo for each course (shown on the Courses page like the call recordings are).
alter table public.classroom_courses add column if not exists cover_url text;
alter table public.classroom_courses drop constraint if exists classroom_courses_cover_url_check;
alter table public.classroom_courses add constraint classroom_courses_cover_url_check check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 500));

drop function if exists public.classroom_overview();
create or replace function public.classroom_overview()
returns table (id uuid, title text, description text, audience text, published boolean, lessons integer, done integer, sort integer, cover_url text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, c.title, c.description, c.audience, c.published,
         (select count(*)::int from public.classroom_lessons l where l.course_id = c.id and l.published),
         (select count(*)::int from public.classroom_progress p join public.classroom_lessons l on l.id = p.lesson_id where p.user_id = auth.uid() and l.course_id = c.id and l.published),
         c.sort, c.cover_url
    from public.classroom_courses c
   where public.classroom_can_see(c.id) and (c.published or public.is_admin())
   order by c.sort, c.created_at
$$;
revoke all on function public.classroom_overview() from public, anon;
grant execute on function public.classroom_overview() to authenticated;
notify pgrst, 'reload schema';
