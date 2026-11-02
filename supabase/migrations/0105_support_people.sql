-- Weekly Focus, round three: no documents are suggested for a hard moment (quitting, giving up, doubt); and everyone can be connected to their coach.
-- the tone of what someone wrote: a hard moment (negative), or wanting to grow (positive)
create or replace function public.support_tone(p_q text) returns text
language sql immutable
as $$
  select case
    when lower(coalesce(p_q, '')) ~ '\m(quit|quitting|give up|giving up|gave up|struggl[a-z]*|tired of|exhausted|overwhelm[a-z]*|hopeless|stuck|depress[a-z]*|anxi[a-z]*|burnt out|burned out|burnout|fail[a-z]*|discourag[a-z]*|doubt[a-z]*|scared|afraid|fear[a-z]*|worthless|can''t|cant|cannot|don''t want|dont want|do not want|no point|sad|alone|miserable|stress[a-z]*|hate|hard time|not working|nothing works|lost|panic[a-z]*|crying|useless|not good enough|imposter|ashamed|unmotivated|no motivation|sick of|fed up|done with)\M' then 'negative'
    when lower(coalesce(p_q, '')) ~ '\m(improve|improving|grow|growth|growing|learn|learning|deepen|better|develop|strengthen|build|building|level up|master|excited|work on|working on|boost|increase|practice|understand)\M' then 'positive'
    else 'neutral' end
$$;

-- which situations a question touches; the check-in (and no documents) only applies when the tone is a hard one
create or replace function public.support_intent(p_q text) returns table (theme text, checkin boolean)
language sql stable
as $$
  select t.name, (t.checkin and public.support_tone(p_q) = 'negative') from public.support_themes t
   where exists (select 1 from unnest(t.triggers) g where lower(coalesce(p_q, '')) ~ ('\m' || regexp_replace(g, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M'))
$$;
revoke all on function public.support_intent(text) from public, anon;
grant execute on function public.support_intent(text) to authenticated;


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
    select 'resource'::text as kind, r.id, null::uuid as parent, r.title, coalesce(r.description, '') as blurb, r.url, null::timestamptz as at,
           ts_rank_cd(v.vec, q.tsq) * 2 as rank, r.kind as sub, null::text as thumb, 0 as reviews
      from public.support_resources r, q, lateral (select to_tsvector('english', r.title || ' ' || coalesce(r.description, '') || ' ' || coalesce(r.keywords, '')) as vec) v
     where v.vec @@ q.tsq
    union all
    select 'recording', c.id, null, c.title, coalesce(c.description, ''), null, c.recorded_at,
           ts_rank_cd(v.vec, q.tsq) + case when c.topics && q.topics then 1 else 0 end, null, c.thumb_url, public.feedback_count(c.call_id)
      from public.recordings c, q, lateral (select to_tsvector('english', c.title || ' ' || coalesce(c.description, '') || ' ' || array_to_string(c.topics, ' ')) as vec) v
     where v.vec @@ q.tsq or c.topics && q.topics
    union all
    select 'lesson', l.id, l.course_id, l.title, coalesce(left(l.body, 160), ''), null, null, ts_rank_cd(v.vec, q.tsq), null, null, 0
      from public.classroom_lessons l, q, lateral (select to_tsvector('english', l.title || ' ' || coalesce(l.body, '')) as vec) v
     where l.published and v.vec @@ q.tsq
    union all
    select 'document', f.id, f.folder_id, f.name, '', null, f.created_at, ts_rank_cd(to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g')), q.tsq), f.mime, f.thumb_path, 0
      from public.doc_files f, q
     where to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g')) @@ q.tsq
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


-- a member's coach: the one they chose (or an admin set); otherwise whoever has them in their Your Organization chart
drop function if exists public.my_support_people();
create function public.my_support_people() returns table (role text, id uuid, first_name text, last_name text, username text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select 'coach', c.id, c.first_name, c.last_name, c.username::text
    from public.profiles c
   where c.id = coalesce((select coach_id from public.profiles where id = auth.uid()),
                         (select n.owner_id from public.family_tree_nodes n where n.linked_member_id = auth.uid() and n.owner_id <> auth.uid() order by n.created_at limit 1))
     and c.id <> auth.uid() and c.removed_at is null
  union all
  select 'buddy', b.id, b.first_name, b.last_name, b.username::text
    from (select case when m.chooser_id = auth.uid() then m.chosen_id else m.chooser_id end as other from public.ab_matches m
           where auth.uid() in (m.chooser_id, m.chosen_id) order by m.created_at limit 1) x
    join public.profiles b on b.id = x.other
$$;
revoke all on function public.my_support_people() from public, anon;
grant execute on function public.my_support_people() to authenticated;

-- choose your own coach
create or replace function public.set_my_coach(p_coach uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_coach is not null and (p_coach = auth.uid() or not public.is_active_affiliate(p_coach)) then raise exception 'choose an affiliate' using errcode = '22023'; end if;
  update public.profiles set coach_id = p_coach where id = auth.uid();
end $$;
revoke all on function public.set_my_coach(uuid) from public, anon;
grant execute on function public.set_my_coach(uuid) to authenticated;
notify pgrst, 'reload schema';
