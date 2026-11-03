-- The Evidence Manual: people who have found success, each with a picture, their top rank and their story.
create table public.evidence_stories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  rank       text not null check (rank in ('6A2-8', '6A2-7', '6A2-6', '6A2-5', '6A2-4', '6A2-3', '6A2-2', '6A2', '6A')),
  story_type text not null default 'other' check (char_length(story_type) between 1 and 40),
  story      text not null check (char_length(btrim(story)) between 1 and 6000),
  photo_url  text check (photo_url is null or (photo_url ~ '^https://\S+$' and char_length(photo_url) <= 1000)),
  created_at timestamptz not null default now()
);
create index evidence_stories_rank on public.evidence_stories (rank, name);
alter table public.evidence_stories enable row level security;
create policy es_read on public.evidence_stories for select to authenticated using (public.can_see('member'));
create policy es_admin on public.evidence_stories for all to authenticated using (public.is_admin()) with check (public.is_admin());
