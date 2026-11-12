-- Builder and Leader: their own courses, to sell outside of Enagic through their own Stripe or PayPal (connected later).
-- Separate from the FLC courses (classroom_*): these belong to the member, and their buyers are the member's own students.

create table public.member_courses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  slug        text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
  description text check (description is null or char_length(description) <= 4000),
  cover_url   text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 300)),
  -- the price buyers pay, in cents (null: not for sale yet)
  price_cents integer check (price_cents is null or price_cents between 100 and 10000000),
  currency    text not null default 'usd' check (currency in ('usd', 'cad', 'eur', 'gbp', 'aud')),
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, slug)
);

create table public.member_lessons (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.member_courses (id) on delete cascade,
  position   integer not null check (position between 0 and 499),
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  body       text check (body is null or char_length(body) <= 20000),
  video_url  text check (video_url is null or video_url ~ '^https://(player\.vimeo\.com/video/[0-9]{3,15}(\?h=[A-Za-z0-9]{1,20})?|www\.youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,20})$'),
  free_preview boolean not null default false,
  created_at timestamptz not null default now()
);
create index member_lessons_course_idx on public.member_lessons (course_id, position);

alter table public.member_courses enable row level security;
alter table public.member_lessons enable row level security;

create policy mc_read on public.member_courses for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy mc_add on public.member_courses for insert to authenticated with check (owner_id = auth.uid() and public.plan_at_least(97::smallint));
create policy mc_change on public.member_courses for update to authenticated
  using (owner_id = auth.uid() and public.plan_at_least(97::smallint)) with check (owner_id = auth.uid() and public.plan_at_least(97::smallint));
create policy mc_remove on public.member_courses for delete to authenticated using (owner_id = auth.uid());

create or replace function public.owns_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.member_courses c where c.id = p_course and c.owner_id = auth.uid()) $$;
revoke all on function public.owns_course(uuid) from public, anon;
grant execute on function public.owns_course(uuid) to authenticated;

create policy ml_read on public.member_lessons for select to authenticated using (public.owns_course(course_id) or public.is_admin());
create policy ml_add on public.member_lessons for insert to authenticated with check (public.owns_course(course_id) and public.plan_at_least(97::smallint));
create policy ml_change on public.member_lessons for update to authenticated
  using (public.owns_course(course_id) and public.plan_at_least(97::smallint)) with check (public.owns_course(course_id) and public.plan_at_least(97::smallint));
create policy ml_remove on public.member_lessons for delete to authenticated using (public.owns_course(course_id) and public.plan_at_least(97::smallint));

-- the public course page: what it is, what it costs, the lesson titles, and the free-preview lessons in full
create or replace function public.public_member_course(p_username text, p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'title', c.title, 'description', c.description, 'cover_url', c.cover_url, 'price_cents', c.price_cents, 'currency', c.currency,
    'owner_first_name', p.first_name, 'owner_last_name', p.last_name, 'owner_photo', p.avatar_url,
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('title', l.title, 'free_preview', l.free_preview,
        'body', case when l.free_preview then l.body end, 'video_url', case when l.free_preview then l.video_url end) order by l.position)
      from public.member_lessons l where l.course_id = c.id), '[]'::jsonb))
  from public.member_courses c join public.profiles p on p.id = c.owner_id
  where p.username = lower(btrim(p_username))::citext and c.slug = lower(btrim(p_slug)) and c.published and public.has_builder(p.id)
$$;
revoke all on function public.public_member_course(text, text) from public;
grant execute on function public.public_member_course(text, text) to anon, authenticated;
