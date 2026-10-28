-- Chat tweaks: full names on posts, any-emoji reactions (one per person, with the time), and locked chats visible to leads.

-- full names
create or replace view public.profile_cards as
  select id, first_name, username, avatar_url, instagram, facebook, last_name
  from public.profiles
  where onboarded_at is not null;

-- reactions: any emoji, one per person per post, remember when
alter table public.chat_reactions drop constraint chat_reactions_kind_check;
delete from public.chat_reactions a using public.chat_reactions b
  where a.post_id = b.post_id and a.user_id = b.user_id and a.ctid < b.ctid;
alter table public.chat_reactions drop constraint chat_reactions_pkey;
alter table public.chat_reactions add primary key (post_id, user_id);
update public.chat_reactions set kind = case kind when 'like' then '👍' when 'love' then '❤️' when 'celebrate' then '🎉' when 'fire' then '🔥' else kind end;
alter table public.chat_reactions add column created_at timestamptz not null default now();
alter table public.chat_reactions add constraint chat_reactions_kind_check
  check (char_length(kind) between 1 and 16 and kind !~ '[A-Za-z0-9<>&"'']' );
create policy reactions_update_own on public.chat_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_chat(public.post_chat(post_id)));

-- everyone signed in can see that a chat exists (leads see the affiliate chats locked); posts stay protected
drop policy chat_sections_read on public.chat_sections;
drop policy chats_read on public.chats;
create policy chat_sections_read on public.chat_sections for select to authenticated using (true);
create policy chats_read on public.chats for select to authenticated using (true);
