-- Documents have a type (book, guide, script, ...) chosen when they are added, and an optional "what it helps with"; Weekly Focus recommends from them.
-- The separate Weekly Focus library of books and websites is no longer used.
alter table public.doc_files add column if not exists doc_type text not null default 'other' check (doc_type in ('book', 'guide', 'script', 'worksheet', 'template', 'presentation', 'other'));
alter table public.doc_files add column if not exists keywords text check (keywords is null or char_length(keywords) <= 600);

-- the search
drop function if exists public.support_search(text);
create function public.support_search(p_q text)
returns table (kind text, id uuid, parent uuid, title text, blurb text, url text, at timestamptz, rank real, sub text, thumb text, reviews integer)
language sql stable
as $$
  with filler as (
    select array['right','now','struggl','feel','want','need','help','get','go','know','think','thing','time','day','week','work','tri','realli','much','lot','back','make','keep','still','just','today','like','better','good','bad','one','way','busi','improv','learn','deepen','knowledg','thing','start','current','someth','somewhat','also','even','alway','never','ever','lately','recent','anyth','everyth'] as w
  ), th as (
    select t.* from public.support_intent(p_q) i join public.support_themes t on t.name = i.theme
  ), theme_words as (
    select distinct lexeme from th, unnest(to_tsvector('english', th.expands))
  ), own_words as (
    select distinct lexeme from unnest(to_tsvector('english', left(coalesce(p_q, ''), 500))), filler where lexeme <> all (filler.w)
  ), q as (
    -- when we recognise what someone is going through we search for that; otherwise for their own words
    select to_tsquery('simple', string_agg(quote_literal(x.lexeme), ' | ')) as tsq, coalesce((select array_agg(distinct tp) from th, unnest(th.topics) tp), '{}') as topics
      from (select lexeme from theme_words union select lexeme from own_words where not exists (select 1 from th)) x
    having count(*) > 0
  ), hits as (
    select 'recording'::text as kind, c.id, null::uuid as parent, c.title, coalesce(c.description, '') as blurb, null::text as url, c.recorded_at as at,
           (ts_rank_cd(v.vec, q.tsq) + case when c.topics && q.topics then 1 else 0 end)::real as rank, null::text as sub, c.thumb_url as thumb, public.feedback_count(c.call_id) as reviews
      from public.recordings c, q, lateral (select to_tsvector('english', c.title || ' ' || coalesce(c.description, '') || ' ' || array_to_string(c.topics, ' ')) as vec) v
     where v.vec @@ q.tsq or c.topics && q.topics
    union all
    select 'lesson', l.id, l.course_id, l.title, coalesce(left(l.body, 160), ''), null, null, ts_rank_cd(v.vec, q.tsq), null, null, 0
      from public.classroom_lessons l, q, lateral (select to_tsvector('english', l.title || ' ' || coalesce(l.body, '')) as vec) v
     where l.published and v.vec @@ q.tsq
    union all
    select 'document', f.id, f.folder_id, f.name, f.doc_type, null, f.created_at, ts_rank_cd(v.vec, q.tsq), f.mime, f.thumb_path, 0
      from public.doc_files f, q, lateral (select to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g') || ' ' || coalesce(f.keywords, '') || ' ' || f.doc_type) as vec) v
     where v.vec @@ q.tsq
       and not exists (select 1 from th where th.checkin)   -- no documents for a hard moment (quitting, giving up, doubt)
    union all
    select 'call', k.id, null, k.title, coalesce(k.description, ''), null, k.starts_at, ts_rank_cd(v.vec, q.tsq), null, null, 0
      from public.calls k, q, lateral (select to_tsvector('english', k.title || ' ' || coalesce(k.description, '')) as vec) v
     where k.starts_at + make_interval(mins => k.duration_minutes) > now() and v.vec @@ q.tsq
  )
  select t.kind, t.id, t.parent, t.title, t.blurb, t.url, t.at, t.rank, t.sub, t.thumb, t.reviews
    from (
      select h.*, row_number() over (
        partition by h.kind
        -- past calls: the most reviewed first, then the newest; everything else: the best match first
        order by case when h.kind = 'recording' then h.reviews end desc nulls last,
                 case when h.kind = 'recording' then null else h.rank end desc nulls last,
                 h.at desc nulls last) as rn
        from hits h) t
   where t.rn <= 6
   order by t.kind, t.rn
$$;
revoke all on function public.support_search(text) from public, anon;
grant execute on function public.support_search(text) to authenticated;
notify pgrst, 'reload schema';
