-- Weekly Focus, smarter (and private: nothing a person types is kept with their name, or word for word): it understands what someone is going through (quitting, doubt, leads going quiet, ads, ...) and not only the words they typed,
-- ignores filler words ("right now", "business"), puts the most-reviewed and newest past calls first, and shows each call's picture.

-- themes: what people say, the words that should be searched because of it, and the call topics that fit
create table if not exists public.support_themes (
  id       serial primary key,
  name     text not null unique,
  triggers text[] not null,                 -- phrases that mean this theme (matched as whole words, lower case)
  expands  text not null default '',        -- words to search for when the theme matches
  topics   text[] not null default '{}',    -- recording topics that fit
  checkin  boolean not null default false   -- ask "have you reached out to your buddy or coach?" first
);
alter table public.support_themes enable row level security;
drop policy if exists st_read on public.support_themes;
create policy st_read on public.support_themes for select to authenticated using (true);
drop policy if exists st_admin on public.support_themes;
create policy st_admin on public.support_themes for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.support_themes (name, triggers, expands, topics, checkin) values
 ('Wanting to quit', array['quit','quitting','give up','giving up','gave up','done with this','burnt out','burned out','burnout','hopeless','cant do this','can''t do this','dont want to do this','don''t want to do this','no point','walk away','not worth it'], 'mindset belief motivation persistence consistency encouragement overcome doubt purpose', array['Belief + Mindset'], true),
 ('Mindset', array['mindset','discouraged','doubt','doubting','imposter','confidence','confident','afraid','fear','scared','nervous','anxious','overwhelmed','overwhelm','stuck','unmotivated','motivation','motivated','negative','self belief','lost my why','my why','comparing'], 'mindset belief motivation overcome doubt confidence purpose', array['Belief + Mindset'], true),
 ('Leads and follow-up', array['follow up','follow-up','followup','ghost','ghosted','ghosting','no response','not responding','never respond','dont respond','don''t respond','no leads','not enough leads','cold leads','lead generation','getting leads','finding leads','leads go quiet'], 'leads follow script talking verbiage respond objections', array['Talking to Leads + Objections','Verbiage + Objections'], false),
 ('Objections', array['objection','objections','push back','pushback','they say no','too expensive','price','hesitant','skeptical','think about it','not interested','cant afford','can''t afford'], 'objection objections verbiage respond leads talking', array['Talking to Leads + Objections','Verbiage + Objections'], false),
 ('Ads', array['ads','advertising','advertise','facebook ads','instagram ads','paid ads','ad budget','running ads'], 'ads advertising budget', array['Ads'], false),
 ('Social media', array['social media','instagram','facebook','tiktok','posting','post more','content','reels','stories','followers'], 'social media posting content reels stories', array['Social Media'], false),
 ('Compensation', array['commission','commissions','compensation','get paid','getting paid','bonus','bonuses','income','how am i paid','pay plan'], 'compensation plan commission bonus income', array['Compensation Plan'], false),
 ('Numbers', array['numbers','track my','tracking','budget','expenses','spreadsheet','know my numbers','money'], 'numbers tracking budget expenses', array['Know Your Numbers','Tracking Your Numbers'], false),
 ('Growing a team', array['stacking','stack','my team','recruit','recruiting','downline','build a team','building a team','mentor','mentoring','duplication','duplicate'], 'stacking team downline mentoring recruiting', array['Stacking','Mentoring Your Downline'], false),
 ('Product knowledge', array['product','products','machine','machines','how it works','features','health benefits','water quality','explain the product'], 'product knowledge features machine', array['Product Knowledge'], false),
 ('In-person sales', array['in person','in-person','face to face','event','events','demo','booth','farmers market','home show'], 'in person sales demo event', array['In Person Sales'], false),
 ('Getting started', array['new here','getting started','just joined','where do i start','where to start','beginner','first steps','new to this','brand new'], 'welcome launch course start onboarding', array['Strategy'], false),
 ('Consistency and time', array['consistent','consistency','time management','schedule','procrastinate','procrastinating','routine','habits','productivity','discipline','focus'], 'consistency habits schedule routine discipline tasks', array['Belief + Mindset','Strategy'], false),
 ('Closing a sale', array['first sale','closing','close the sale','close more','closing a sale','sales call','selling','how to sell'], 'closing sale script talking leads', array['Strategy','Talking to Leads + Objections','In Person Sales'], false)
on conflict (name) do nothing;

-- how many people left feedback on a call (counted for everyone, even though they only read their own)
create or replace function public.feedback_count(p_call uuid) returns integer
language sql stable security definer set search_path = public, pg_temp
as $$ select count(*)::integer from public.call_feedback where call_id = p_call and p_call is not null $$;
revoke all on function public.feedback_count(uuid) from public, anon;
grant execute on function public.feedback_count(uuid) to authenticated;

-- which themes a question touches (and whether to ask about the buddy and coach first)
create or replace function public.support_intent(p_q text) returns table (theme text, checkin boolean)
language sql stable
as $$
  select t.name, t.checkin from public.support_themes t
   where exists (select 1 from unnest(t.triggers) g where lower(coalesce(p_q, '')) ~ ('\m' || regexp_replace(g, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M'))
$$;
revoke all on function public.support_intent(text) from public, anon;
grant execute on function public.support_intent(text) to authenticated;

-- the person's own coach and accountability buddy (names and usernames only)
create or replace function public.my_support_people() returns table (role text, first_name text, last_name text, username text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select 'coach', c.first_name, c.last_name, c.username::text from public.profiles me join public.profiles c on c.id = me.coach_id where me.id = auth.uid()
  union all
  select 'buddy', b.first_name, b.last_name, b.username::text
    from (select case when m.chooser_id = auth.uid() then m.chosen_id else m.chooser_id end as other from public.ab_matches m
           where auth.uid() in (m.chooser_id, m.chosen_id) order by m.created_at desc limit 1) x
    join public.profiles b on b.id = x.other
$$;
revoke all on function public.my_support_people() from public, anon;
grant execute on function public.my_support_people() to authenticated;

-- the search
drop function if exists public.support_search(text);
create function public.support_search(p_q text)
returns table (kind text, id uuid, parent uuid, title text, blurb text, url text, at timestamptz, rank real, sub text, thumb text, reviews integer)
language sql stable
as $$
  with filler as (
    select array['right','now','struggl','feel','want','need','help','get','go','know','think','thing','time','day','week','work','tri','realli','much','lot','back','make','keep','still','just','today','like','better','good','bad','one','way','busi','improv','learn','deepen','knowledg','thing','start','current','someth','somewhat','also','even','alway','never','ever','lately','recent','anyth','everyth'] as w
  ), th as (
    select * from public.support_intent(p_q) i join public.support_themes t on t.name = i.theme
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
    select 'document', f.id, f.folder_id, f.name, '', null, f.created_at, ts_rank_cd(to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g')), q.tsq), null, null, 0
      from public.doc_files f, q
     where to_tsvector('english', regexp_replace(f.name, '[._-]', ' ', 'g')) @@ q.tsq
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

-- ---------------------------------------------------------------- anonymous: what people ask is never stored with a name, or as the question they typed
-- Only the matching themes and the main words are kept (plus the day and whether anything was found). Nobody, admins included, can see who asked what.
drop table if exists public.support_questions cascade;
create table if not exists public.support_asks (
  id     bigserial primary key,
  day    date not null default current_date,
  themes text[] not null default '{}',
  words  text[] not null default '{}',
  found  integer not null default 0
);
alter table public.support_asks enable row level security;
revoke all on public.support_asks from public, anon, authenticated;   -- only the two functions below touch it

create or replace function public.log_support_ask(p_q text, p_found integer) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare ws text[]; ths text[];
begin
  if auth.uid() is null or coalesce(btrim(p_q), '') = '' then return; end if;
  select coalesce(array_agg(distinct i.theme), '{}') into ths from public.support_intent(p_q) i;
  select coalesce(array_agg(distinct lower(d.token)), '{}') into ws
    from ts_debug('english', left(p_q, 500)) d
   where d.lexemes is not null and char_length(d.token) >= 4
     and d.lexemes[1] <> all (array['right','now','struggl','feel','want','need','help','get','go','know','think','thing','time','day','week','work','tri','realli','much','lot','back','make','keep','still','just','today','like','better','good','bad','one','way','busi','improv','learn','deepen','knowledg','start','current','someth','also','even','alway','never','ever','late','recent','anyth','everyth']);
  insert into public.support_asks (themes, words, found) values (ths, ws[1:8], greatest(coalesce(p_found, 0), 0));
end $$;
revoke all on function public.log_support_ask(text, integer) from public, anon;
grant execute on function public.log_support_ask(text, integer) to authenticated;

-- for admins: only needs that keep coming up (asked at least 3 times in the last 90 days), as counts. No names, no questions.
create or replace function public.support_suggestions() returns table (label text, kind text, asked integer, nothing_found integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select x.label, x.kind, count(*)::integer, (count(*) filter (where x.found = 0))::integer
    from (
      select t as label, 'theme'::text as kind, a.found from public.support_asks a, unnest(a.themes) t where a.day >= current_date - 90
      union all
      select w, 'word', a.found from public.support_asks a, unnest(a.words) w where a.day >= current_date - 90
    ) x
   where public.is_admin()
   group by x.label, x.kind
  having count(*) >= 3
   order by (count(*) filter (where x.found = 0)) desc, count(*) desc
   limit 60
$$;
revoke all on function public.support_suggestions() from public, anon;
grant execute on function public.support_suggestions() to authenticated;
notify pgrst, 'reload schema';
