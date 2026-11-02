-- "Get Support": a member types what they are struggling with and gets suggestions: calls to join, recordings to watch,
-- courses, documents, and books, websites and other resources an admin has recommended. Nothing here uses security definer,
-- so every list is limited to what that person is already allowed to see.

-- the recommended library an admin keeps
create table if not exists public.support_resources (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'website' check (kind in ('book', 'website', 'video', 'podcast', 'document', 'other')),
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  description  text check (description is null or char_length(description) <= 600),
  url          text check (url is null or url ~ '^https://\S+$'),
  keywords     text check (keywords is null or char_length(keywords) <= 600),   -- extra words that should find it ("stuck, no leads, motivation")
  for_leads    boolean not null default false,
  for_downline boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.support_resources enable row level security;
drop policy if exists sr_read on public.support_resources;
create policy sr_read on public.support_resources for select to authenticated using (
  public.can_see('member') or (for_leads and public.app_current_role() = 'lead') or (for_downline and public.app_current_role() = 'downline'));
drop policy if exists sr_admin on public.support_resources;
create policy sr_admin on public.support_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- what people asked, so admins can see what help is needed (and what has no answer yet)
create table if not exists public.support_questions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  question   text not null check (char_length(btrim(question)) between 1 and 500),
  found      integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists support_questions_recent on public.support_questions (created_at desc);
alter table public.support_questions enable row level security;
drop policy if exists sq_insert on public.support_questions;
create policy sq_insert on public.support_questions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists sq_admin on public.support_questions;
create policy sq_admin on public.support_questions for select to authenticated using (public.is_admin());
drop policy if exists sq_delete on public.support_questions;
create policy sq_delete on public.support_questions for delete to authenticated using (public.is_admin());

-- the search: any word in the question can match, the best matches come first, at most six of each kind
create or replace function public.support_search(p_q text)
returns table (kind text, id uuid, parent uuid, title text, blurb text, url text, at timestamptz, rank real, sub text)
language sql stable
as $$
  with q as (
    select to_tsquery('simple', string_agg(quote_literal(w.lexeme), ' | ')) as tsq
      from (select distinct lexeme from unnest(to_tsvector('english', left(coalesce(p_q, ''), 500)))) w
     having count(*) > 0
  ), hits as (
    select 'resource'::text as kind, r.id, null::uuid as parent, r.title, coalesce(r.description, '') as blurb, r.url, null::timestamptz as at,
           ts_rank_cd(v.vec, q.tsq) * 2 as rank, r.kind as sub
      from public.support_resources r, q, lateral (select to_tsvector('english', r.title || ' ' || coalesce(r.description, '') || ' ' || coalesce(r.keywords, '')) as vec) v
     where v.vec @@ q.tsq
    union all
    select 'recording', c.id, null, c.title, coalesce(c.description, ''), null, c.recorded_at, ts_rank_cd(v.vec, q.tsq), null
      from public.recordings c, q, lateral (select to_tsvector('english', c.title || ' ' || coalesce(c.description, '') || ' ' || array_to_string(c.topics, ' ')) as vec) v
     where v.vec @@ q.tsq
    union all
    select 'lesson', l.id, l.course_id, l.title, coalesce(left(l.body, 160), ''), null, null, ts_rank_cd(v.vec, q.tsq), null
      from public.classroom_lessons l, q, lateral (select to_tsvector('english', l.title || ' ' || coalesce(l.body, '')) as vec) v
     where l.published and v.vec @@ q.tsq
    union all
    select 'document', f.id, f.folder_id, f.name, '', null, f.created_at, ts_rank_cd(to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g')), q.tsq), null
      from public.doc_files f, q
     where to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g')) @@ q.tsq
    union all
    select 'call', k.id, null, k.title, coalesce(k.description, ''), null, k.starts_at, ts_rank_cd(v.vec, q.tsq), null
      from public.calls k, q, lateral (select to_tsvector('english', k.title || ' ' || coalesce(k.description, '')) as vec) v
     where k.starts_at + make_interval(mins => k.duration_minutes) > now() and v.vec @@ q.tsq
  )
  select t.kind, t.id, t.parent, t.title, t.blurb, t.url, t.at, t.rank, t.sub
    from (select h.*, row_number() over (partition by h.kind order by h.rank desc, h.at desc nulls last) as rn from hits h) t
   where t.rn <= 6
   order by t.kind, t.rank desc
$$;
revoke all on function public.support_search(text) from public, anon;
grant execute on function public.support_search(text) to authenticated;
notify pgrst, 'reload schema';
