-- Admins can pin posts to the top of any chat. Plus the last two chat subtitles.
alter table public.chat_posts add column pinned_at timestamptz;
create index chat_posts_pinned_idx on public.chat_posts (chat_id, pinned_at desc) where pinned_at is not null;

-- Only admins pin, and pinning changes nothing else about the post.
create function public.set_post_pinned(p_post uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'only admins can pin posts' using errcode = '42501'; end if;
  update public.chat_posts set pinned_at = case when p_pinned then now() else null end where id = p_post;
end $$;
revoke all on function public.set_post_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_post_pinned(uuid, boolean) to authenticated;

-- A post's author must not be able to pin their own post by editing the row.
create function public.chat_posts_guard_pin() returns trigger language plpgsql security invoker as $$
begin
  if new.pinned_at is distinct from old.pinned_at and current_user in ('authenticated', 'anon') then
    raise exception 'only admins can pin posts' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger chat_posts_guard_pin before update on public.chat_posts for each row execute function public.chat_posts_guard_pin();

update public.chats set description = 'Want more than 50 follows on Facebook? Or looking for more Instagram followers? Or maybe some engagement or feedback on your story, reel, post, or carousel? Post your links here!' where slug = 'social-media';
update public.chats set description = 'Post your lead''s objections and questions here or screenshot messages for feedback or help on how to respond. Vote for your favourite responses and if they reach 15+ votes, they get added to our Verbiage + Objections tab on the left side of the screen.' where slug = 'verbiage-objections';
