-- Landing page choices.
-- Builder ($97) and Leader ($297): their own words, their own video and their own video cover picture.
-- Everyone else ($33 / $47): a switch between the video that comes with the account and their coach's video,
-- offered only when their coach is on Builder or Leader and has put up their own video.

alter table public.landing_pages
  add column copy jsonb,
  add column video_url text,
  add column poster_url text,
  add column video_choice text not null default 'standard';

-- the words a Builder can change: known keys only, each a short piece of text
create or replace function public.landing_copy_ok(c jsonb) returns boolean language sql immutable
as $$
  select c is null or (
    jsonb_typeof(c) = 'object'
    and not exists (
      select 1 from jsonb_each(c) e
       where e.key not in ('eyebrow', 'title1', 'title2', 'sub', 'cta', 'join_title', 'join_sub')
          or jsonb_typeof(e.value) <> 'string'
          or char_length(e.value #>> '{}') > 400))
$$;

alter table public.landing_pages
  add constraint landing_copy_ok check (public.landing_copy_ok(copy)),
  -- only Vimeo or YouTube players, stored as the player address the page can show
  add constraint landing_video_fmt check (video_url is null or video_url ~ '^https://(player\.vimeo\.com/video/[0-9]{3,15}(\?h=[A-Za-z0-9]{1,20})?|www\.youtube-nocookie\.com/embed/[A-Za-z0-9_-]{6,20})$'),
  add constraint landing_poster_len check (poster_url is null or char_length(poster_url) <= 300),
  add constraint landing_video_choice check (video_choice in ('standard', 'coach'));

-- changing words, video or picture needs Builder or Leader (admins always can)
create or replace function public.landing_custom_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.plan_at_least(97::smallint) then return new; end if;
  if tg_op = 'INSERT' then
    if new.copy is not null or new.video_url is not null or new.poster_url is not null then
      raise exception 'changing the words, video or picture needs the Builder plan' using errcode = '42501';
    end if;
  elsif new.copy is distinct from old.copy or new.video_url is distinct from old.video_url or new.poster_url is distinct from old.poster_url then
    -- clearing them is always allowed, so a member who moved down a plan can tidy up
    if new.copy is not null or new.video_url is not null or new.poster_url is not null then
      raise exception 'changing the words, video or picture needs the Builder plan' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger landing_custom_guard before insert or update on public.landing_pages for each row execute function public.landing_custom_guard();

-- is this person on Builder or Leader (or an admin), and still in the community?
create or replace function public.has_builder(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = p_id and p.removed_at is null and (p.role = 'admin' or coalesce(p.plan, 0) >= 97)) $$;
revoke all on function public.has_builder(uuid) from public, anon, authenticated;

-- the coach's own video, if their coach can have one and has put one up
create or replace function public.coach_video(p_member uuid) returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select l.video_url
    from public.profiles m
    join public.landing_pages l on l.member_id = m.coach_id
   where m.id = p_member and m.coach_id is not null and public.has_builder(m.coach_id) and l.video_url is not null
$$;
revoke all on function public.coach_video(uuid) from public, anon, authenticated;

-- for the switch on the Landing Page tab: can I use my coach's video, and whose is it?
create or replace function public.my_coach_video() returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when public.coach_video(auth.uid()) is null then null else
    (select jsonb_build_object('coach_first_name', c.first_name, 'coach_last_name', c.last_name)
       from public.profiles m join public.profiles c on c.id = m.coach_id where m.id = auth.uid()) end
$$;
revoke all on function public.my_coach_video() from public, anon;
grant execute on function public.my_coach_video() to authenticated;

-- the public page now also carries the words, video and picture that apply
create or replace function public.public_landing(p_username text) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'member_id', p.id,
    'username', p.username,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'photo_url', coalesce(l.photo_url, p.avatar_url),
    'instagram', case when l.instagram is null then p.instagram when l.instagram = '' then null else l.instagram end,
    'facebook',  case when l.facebook  is null then p.facebook  when l.facebook  = '' then null else l.facebook  end,
    'theme', coalesce(l.theme, 'light'),
    'copy', case when public.has_builder(p.id) then l.copy end,
    'poster_url', case when public.has_builder(p.id) then l.poster_url end,
    'video_url', case
      when public.has_builder(p.id) and l.video_url is not null then l.video_url
      when coalesce(l.video_choice, 'standard') = 'coach' then public.coach_video(p.id)
    end)
  from public.profiles p left join public.landing_pages l on l.member_id = p.id
  where p.username = lower(btrim(p_username))::citext and p.role in ('member', 'admin') and p.onboarded_at is not null
$$;
revoke all on function public.public_landing(text) from public;
grant execute on function public.public_landing(text) to anon, authenticated;
