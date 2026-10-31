-- Facebook Follows: affiliates list their Facebook page, other affiliates follow it and tap "I followed". At 50 follows the page leaves the list.
-- (Facebook cannot tell us who really followed, so the count is the follows people confirm here.)
create table public.fb_follow_pages (
  member_id    uuid primary key references public.profiles (id) on delete cascade,
  page_url     text not null check (char_length(page_url) <= 300 and page_url ~ '^https://(www\.|m\.)?facebook\.com/[^[:space:]]+$'),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create table public.fb_follows (
  target_id   uuid not null references public.fb_follow_pages (member_id) on delete cascade,
  follower_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (target_id, follower_id),
  check (target_id <> follower_id)
);
-- closed tables: everything goes through the functions below
alter table public.fb_follow_pages enable row level security;
alter table public.fb_follows enable row level security;

create function public.fb_follow_list() returns table (member_id uuid, first_name text, last_name text, username citext, avatar_url text, page_url text, follows integer, i_followed boolean, created_at timestamptz, completed_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, f.page_url,
         (select count(*)::int from public.fb_follows x where x.target_id = f.member_id),
         exists (select 1 from public.fb_follows x where x.target_id = f.member_id and x.follower_id = auth.uid()),
         f.created_at, f.completed_at, f.member_id = auth.uid()
  from public.fb_follow_pages f join public.profiles p on p.id = f.member_id
  where public.is_active_affiliate(auth.uid()) and p.removed_at is null and (f.completed_at is null or f.member_id = auth.uid())
  order by (f.member_id = auth.uid()) desc, f.created_at desc
$$;
revoke all on function public.fb_follow_list() from public, anon;
grant execute on function public.fb_follow_list() to authenticated;

create function public.fb_follow_add(p_url text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_active_affiliate(auth.uid()) then raise exception 'affiliates only' using errcode = '42501'; end if;
  insert into public.fb_follow_pages (member_id, page_url) values (auth.uid(), btrim(p_url))
  on conflict (member_id) do update set page_url = excluded.page_url where public.fb_follow_pages.completed_at is null;
end $$;
revoke all on function public.fb_follow_add(text) from public, anon;
grant execute on function public.fb_follow_add(text) to authenticated;

create function public.fb_follow_set(p_target uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if not public.is_active_affiliate(auth.uid()) then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_target = auth.uid() then raise exception 'not your own page' using errcode = '42501'; end if;
  if not exists (select 1 from public.fb_follow_pages where member_id = p_target and completed_at is null) then raise exception 'not on the list' using errcode = 'P0002'; end if;
  if p_on then
    insert into public.fb_follows (target_id, follower_id) values (p_target, auth.uid()) on conflict do nothing;
    select count(*) into n from public.fb_follows where target_id = p_target;
    if n >= 50 then
      update public.fb_follow_pages set completed_at = now() where member_id = p_target and completed_at is null;
      if found then perform public.notify_user(p_target, 'announcement', '🎉 You reached 50 Facebook follows', 'Your page has come off the Facebook Follows list. Thank you, community!', '/facebook-follows'); end if;
    end if;
  else
    delete from public.fb_follows where target_id = p_target and follower_id = auth.uid();
  end if;
end $$;
revoke all on function public.fb_follow_set(uuid, boolean) from public, anon;
grant execute on function public.fb_follow_set(uuid, boolean) to authenticated;

-- take a page off the list: your own, or (as an admin) anyone's
create function public.fb_follow_remove(p_target uuid default null) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare who uuid := coalesce(p_target, auth.uid());
begin
  if who is distinct from auth.uid() and not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.fb_follow_pages where member_id = who;
end $$;
revoke all on function public.fb_follow_remove(uuid) from public, anon;
grant execute on function public.fb_follow_remove(uuid) to authenticated;

-- keep the page address out of reach of landing-page usernames
insert into public.reserved_usernames (username) values ('facebook-follows'), ('facebookfollows') on conflict do nothing;
