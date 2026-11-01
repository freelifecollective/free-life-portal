-- The course library: 15 courses as drafts, for affiliates only, with no lessons and no cover yet. Run once in the Supabase SQL Editor.
-- Add a cover photo and lessons to each from Manage courses, then tick "Show this course to members".
-- Safe to run more than once: a course that already exists (same title) is not created again.
with new_courses (title, description, n) as (
  values
  ('The Roadmap to Success (RTS)', null, 1),
  ('Containers with Lacey', 'Private mentorship with Lacey Bahns.', 2),
  ('Ad Restrictions', null, 3),
  ('Automation + Emails', null, 4),
  ('Calls + Placing Sales', null, 5),
  ('Follow Up + Talking to Leads', null, 6),
  ('Know Your Numbers', null, 7),
  ('Mindset + Personal Development', null, 8),
  ('Mindset 101 with Adrian Wesley', 'With Adrian Wesley.', 9),
  ('Offline Sales', null, 10),
  ('Sales Summit Training', 'With Keala Kanae.', 11),
  ('Straight Line Persuasion with Jordan', 'With Jordan.', 12),
  ('Welcome to the Water Hub', null, 13),
  ('Free Life Collective Discovery Process', null, 14),
  ('21-Day Magnetic Storytelling Challenge', 'From stuck and silent to magnetic and unforgettable, in 21 days.', 15)
), base as (select coalesce(max(sort), 0) as m from public.classroom_courses)
insert into public.classroom_courses (title, description, audience, published, sort)
select n.title, n.description, 'affiliates', false, base.m + n.n
  from new_courses n cross join base
 where not exists (select 1 from public.classroom_courses c where c.title = n.title);

notify pgrst, 'reload schema';
