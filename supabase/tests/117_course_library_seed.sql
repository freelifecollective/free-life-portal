-- The course library seed: 15 drafts with covers, safe to run twice.
begin;
\ir ../seeds/course-library.sql
do $$ begin
  if (select count(*) from public.classroom_courses) <> 15 then raise exception 'FAIL expected 15 courses, got %', (select count(*) from public.classroom_courses); end if;
  raise notice 'ok   15 courses created';
  if exists (select 1 from public.classroom_courses where published or audience <> 'affiliates' or cover_url is null or cover_url !~ '^https://') then raise exception 'FAIL every course should be a draft for affiliates with a cover'; end if;
  raise notice 'ok   all drafts, affiliates only, all with covers';
end $$;
\ir ../seeds/course-library.sql
do $$ begin
  if (select count(*) from public.classroom_courses) <> 15 then raise exception 'FAIL running it twice made duplicates'; end if;
  raise notice 'ok   running it twice makes no duplicates';
end $$;
rollback;

-- a course that already exists keeps its own details and only gets a cover if it has none
begin;
insert into public.classroom_courses (title, description, audience, published, sort) values ('Ad Restrictions', 'my words', 'everyone', true, 5);
\ir ../seeds/course-library.sql
do $$ begin
  if (select count(*) from public.classroom_courses where title = 'Ad Restrictions') <> 1 then raise exception 'FAIL duplicate Ad Restrictions'; end if;
  if (select description || audience || published::text from public.classroom_courses where title = 'Ad Restrictions') <> 'my wordseveryonetrue' then raise exception 'FAIL changed an existing course'; end if;
  if (select cover_url from public.classroom_courses where title = 'Ad Restrictions') is null then raise exception 'FAIL the existing course got no cover'; end if;
  raise notice 'ok   an existing course keeps its details and gets a cover';
end $$;
rollback;
