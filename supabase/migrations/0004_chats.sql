-- Phase 5a: Chats (feed-style discussion), reactions, comments, and votes for the Verbiage/Objections chat.

insert into public.reserved_usernames (username) values
  ('chats'), ('financing'), ('outsourcing'), ('water-map'), ('watermap'), ('responses'), ('follows'), ('downline'), ('recording'), ('feedback')
on conflict do nothing;

-- ---------------------------------------------------------------- sections and chats
create table public.chat_sections (
  id       smallint primary key,
  name     text not null,
  sort     smallint not null unique,
  min_role public.app_role not null default 'lead'
);
create table public.chats (
  id          uuid primary key default gen_random_uuid(),
  section_id  smallint not null references public.chat_sections (id),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text,
  sort        smallint not null default 0,
  min_role    public.app_role not null default 'lead',
  votes_on    boolean not null default false   -- true: members can vote on posts (Verbiage/Objections)
);
create index chats_section_idx on public.chats (section_id, sort);

insert into public.chat_sections (id, name, sort, min_role) values (1, 'New Members', 1, 'lead'), (2, 'Affiliates Only', 2, 'member');
insert into public.chats (section_id, slug, name, description, sort, min_role, votes_on) values
  (1, 'welcome-discussion',  'Welcome + Discussion',             'Say hello and talk about anything.', 1, 'lead', false),
  (1, 'wins',                'Wins',                             'Share a win, big or small.', 2, 'lead', false),
  (2, 'qa-discussion',       'Q+A Discussion',                   'Ask questions and help each other.', 1, 'member', false),
  (2, 'ads',                 'Ads',                              null, 2, 'member', false),
  (2, 'in-person-sales',     'In-Person Sales',                  null, 3, 'member', false),
  (2, 'onboarding',          'Onboarding/Business Launch',       null, 4, 'member', false),
  (2, 'product-questions',   'Product Questions',                null, 5, 'member', false),
  (2, 'resources',           'Resources',                        null, 6, 'member', false),
  (2, 'social-media',        'Social Media Page/Reels/Stories',  null, 7, 'member', false),
  (2, 'verbiage-objections', 'Verbiage/Objections',              'Suggest how to respond, and vote on the best answers.', 8, 'member', true);

alter table public.chat_sections enable row level security;
alter table public.chats enable row level security;
create policy chat_sections_read on public.chat_sections for select to authenticated using (public.can_see(min_role));
create policy chats_read on public.chats for select to authenticated using (public.can_see(min_role));
create policy chats_admin_all on public.chats for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chat_sections_admin_all on public.chat_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.can_see_chat(p_chat uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select public.can_see(c.min_role) from public.chats c where c.id = p_chat), false) $$;
revoke all on function public.can_see_chat(uuid) from public, anon;
grant execute on function public.can_see_chat(uuid) to authenticated;

-- ---------------------------------------------------------------- posts
create table public.chat_posts (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index chat_posts_chat_idx on public.chat_posts (chat_id, created_at desc);

create table public.chat_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.chat_posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_comments_post_idx on public.chat_comments (post_id, created_at);

create table public.chat_reactions (
  post_id uuid not null references public.chat_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind    text not null check (kind in ('like', 'love', 'celebrate', 'fire')),
  primary key (post_id, user_id, kind)
);

create table public.chat_votes (
  post_id uuid not null references public.chat_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create function public.post_chat(p_post uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select chat_id from public.chat_posts where id = p_post $$;
revoke all on function public.post_chat(uuid) from public, anon;
grant execute on function public.post_chat(uuid) to authenticated;

alter table public.chat_posts enable row level security;
alter table public.chat_comments enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.chat_votes enable row level security;

create policy posts_read on public.chat_posts for select to authenticated using (public.can_see_chat(chat_id));
create policy posts_insert on public.chat_posts for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_chat(chat_id));
create policy posts_update_own on public.chat_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and public.can_see_chat(chat_id));
create policy posts_delete on public.chat_posts for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy comments_read on public.chat_comments for select to authenticated using (public.can_see_chat(public.post_chat(post_id)));
create policy comments_insert on public.chat_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_chat(public.post_chat(post_id)));
create policy comments_delete on public.chat_comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy reactions_read on public.chat_reactions for select to authenticated using (public.can_see_chat(public.post_chat(post_id)));
create policy reactions_insert on public.chat_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_chat(public.post_chat(post_id)));
create policy reactions_delete on public.chat_reactions for delete to authenticated using (user_id = auth.uid());

-- Votes only in chats with voting on, and never for your own post.
create function public.can_vote(p_post uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.chat_posts p join public.chats c on c.id = p.chat_id
    where p.id = p_post and c.votes_on and p.author_id <> auth.uid() and public.can_see(c.min_role)
  )
$$;
revoke all on function public.can_vote(uuid) from public, anon;
grant execute on function public.can_vote(uuid) to authenticated;

create policy votes_read on public.chat_votes for select to authenticated using (public.can_see_chat(public.post_chat(post_id)));
create policy votes_insert on public.chat_votes for insert to authenticated
  with check (user_id = auth.uid() and public.can_vote(post_id));
create policy votes_delete on public.chat_votes for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- "How to Respond to Leads": answers with more than 15 votes
create view public.top_responses with (security_invoker = true) as
  select p.id, p.chat_id, p.author_id, p.body, p.created_at, count(v.user_id)::int as votes
  from public.chat_posts p
  join public.chats c on c.id = p.chat_id and c.votes_on
  join public.chat_votes v on v.post_id = p.id
  group by p.id
  having count(v.user_id) > 15;
revoke all on public.top_responses from public, anon;
grant select on public.top_responses to authenticated;

alter publication supabase_realtime add table public.chat_posts, public.chat_comments, public.chat_reactions, public.chat_votes;
