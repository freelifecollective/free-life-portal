-- Classroom: courses made of lessons (a Vimeo video, written notes). Admins build them; members watch and tick lessons off.
create table if not exists public.classroom_courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  audience    text not null default 'affiliates' check (audience in ('everyone', 'affiliates')),
  sort        integer not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create table if not exists public.classroom_lessons (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.classroom_courses (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  body       text check (body is null or char_length(body) <= 8000),
  vimeo_id   text check (vimeo_id is null or vimeo_id ~ '^[0-9]{5,14}$'),
  vimeo_hash text check (vimeo_hash is null or vimeo_hash ~ '^[a-z0-9]{6,32}$'),
  sort       integer not null default 0,
  published  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists classroom_lessons_course on public.classroom_lessons (course_id, sort);
create table if not exists public.classroom_progress (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.classroom_lessons (id) on delete cascade,
  done_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.classroom_courses enable row level security;
alter table public.classroom_lessons enable row level security;
alter table public.classroom_progress enable row level security;

create or replace function public.classroom_can_see(p_course uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.classroom_courses c where c.id = p_course and (public.is_admin() or (c.published and ((c.audience = 'everyone' and public.can_see('lead')) or (c.audience = 'affiliates' and public.can_see('member')))))) $$;
revoke all on function public.classroom_can_see(uuid) from public, anon;
grant execute on function public.classroom_can_see(uuid) to authenticated;

drop policy if exists cc_read on public.classroom_courses;
create policy cc_read on public.classroom_courses for select to authenticated using (public.classroom_can_see(id));
drop policy if exists cc_admin on public.classroom_courses;
create policy cc_admin on public.classroom_courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cl_read on public.classroom_lessons;
create policy cl_read on public.classroom_lessons for select to authenticated using (public.classroom_can_see(course_id) and (published or public.is_admin()));
drop policy if exists cl_admin on public.classroom_lessons;
create policy cl_admin on public.classroom_lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cp_own on public.classroom_progress;
create policy cp_own on public.classroom_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.classroom_lessons l where l.id = lesson_id and public.classroom_can_see(l.course_id) and l.published));

-- every course I can see, with how many lessons it has and how many I finished
create or replace function public.classroom_overview()
returns table (id uuid, title text, description text, audience text, published boolean, lessons integer, done integer, sort integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, c.title, c.description, c.audience, c.published,
         (select count(*)::int from public.classroom_lessons l where l.course_id = c.id and l.published),
         (select count(*)::int from public.classroom_progress p join public.classroom_lessons l on l.id = p.lesson_id where p.user_id = auth.uid() and l.course_id = c.id and l.published),
         c.sort
    from public.classroom_courses c
   where public.classroom_can_see(c.id) and (c.published or public.is_admin())
   order by c.sort, c.created_at
$$;
revoke all on function public.classroom_overview() from public, anon;
grant execute on function public.classroom_overview() to authenticated;

insert into public.reserved_usernames (username) values ('classroom') on conflict do nothing;
notify pgrst, 'reload schema';
