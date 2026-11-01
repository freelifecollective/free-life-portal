-- Phase 94: old replies (comments) in the chats that are now conversations become ordinary messages that quote the post they
-- answered, so they can be reacted to, edited and pinned like any other message. Safe to run more than once.
alter table public.chat_posts disable trigger chat_posts_push;   -- moving old replies must not send anyone a push
with moved as (
  delete from public.chat_comments c
   using public.chat_posts p, public.chats ch
   where p.id = c.post_id and ch.id = p.chat_id and ch.mode = 'conversation'
   returning c.post_id, c.author_id, c.body, c.created_at
)
insert into public.chat_posts (chat_id, author_id, body, created_at, reply_to)
  select p.chat_id, m.author_id, m.body, m.created_at, m.post_id from moved m join public.chat_posts p on p.id = m.post_id;
alter table public.chat_posts enable trigger chat_posts_push;
notify pgrst, 'reload schema';
