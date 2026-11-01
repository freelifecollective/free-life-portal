-- The course library, with a cover photo for each course (the covers are the pictures in public/course-covers). Run once in the Supabase SQL Editor.
-- They start hidden (drafts) for affiliates only, with no lessons yet: add lessons, then tick "Show this course to members" on each.
-- Safe to run more than once: a course that already exists (same title) is not created again, it only gets a cover if it has none.
with new_courses (title, description, cover_url, n) as (
  values
  ('The Roadmap to Success (RTS)', null, 'https://free-life-portal.vercel.app/course-covers/roadmap-to-success.jpg', 1),
  ('Set Up Your Funnel Owner Account', 'With Sonya F Ruthven.', 'https://free-life-portal.vercel.app/course-covers/funnel-owner-account.jpg', 2),
  ('Containers with Lacey', 'Private mentorship with Lacey Bahns.', 'https://free-life-portal.vercel.app/course-covers/containers.jpg', 3),
  ('Ad Restrictions', null, 'https://free-life-portal.vercel.app/course-covers/ad-restrictions.jpg', 4),
  ('Automation + Emails', null, 'https://free-life-portal.vercel.app/course-covers/automation-emails.jpg', 5),
  ('Calls + Placing Sales', null, 'https://free-life-portal.vercel.app/course-covers/calls-placing-sales.jpg', 6),
  ('Follow Up + Talking to Leads', null, 'https://free-life-portal.vercel.app/course-covers/follow-up-leads.jpg', 7),
  ('Know Your Numbers', null, 'https://free-life-portal.vercel.app/course-covers/know-your-numbers.jpg', 8),
  ('Mindset + Personal Development', null, 'https://free-life-portal.vercel.app/course-covers/mindset-personal-development.jpg', 9),
  ('Mindset 101 with Adrian Wesley', 'With Adrian Wesley.', 'https://free-life-portal.vercel.app/course-covers/mindset-101.jpg', 10),
  ('Offline Sales', null, 'https://free-life-portal.vercel.app/course-covers/offline-sales.jpg', 11),
  ('Sales Summit Training', 'With Keala Kanae.', 'https://free-life-portal.vercel.app/course-covers/sales-summit.jpg', 12),
  ('Straight Line Persuasion with Jordan', 'With Jordan.', 'https://free-life-portal.vercel.app/course-covers/straight-line-persuasion.jpg', 13),
  ('Welcome to the Water Hub', null, 'https://free-life-portal.vercel.app/course-covers/water-hub.jpg', 14),
  ('Free Life Collective Discovery Process', null, 'https://free-life-portal.vercel.app/course-covers/discovery-process.jpg', 15),
  ('21-Day Magnetic Storytelling Challenge', 'From stuck and silent to magnetic and unforgettable, in 21 days.', 'https://free-life-portal.vercel.app/course-covers/magnetic-storytelling.jpg', 16),
  ('GHL How To''s', null, 'https://free-life-portal.vercel.app/course-covers/ghl-how-tos.jpg', 17)
), base as (select coalesce(max(sort), 0) as m from public.classroom_courses)
insert into public.classroom_courses (title, description, audience, published, cover_url, sort)
select n.title, n.description, 'affiliates', false, n.cover_url, base.m + n.n
  from new_courses n cross join base
 where not exists (select 1 from public.classroom_courses c where c.title = n.title);

update public.classroom_courses c set cover_url = n.cover_url
  from (values
  ('The Roadmap to Success (RTS)', null, 'https://free-life-portal.vercel.app/course-covers/roadmap-to-success.jpg', 1),
  ('Set Up Your Funnel Owner Account', 'With Sonya F Ruthven.', 'https://free-life-portal.vercel.app/course-covers/funnel-owner-account.jpg', 2),
  ('Containers with Lacey', 'Private mentorship with Lacey Bahns.', 'https://free-life-portal.vercel.app/course-covers/containers.jpg', 3),
  ('Ad Restrictions', null, 'https://free-life-portal.vercel.app/course-covers/ad-restrictions.jpg', 4),
  ('Automation + Emails', null, 'https://free-life-portal.vercel.app/course-covers/automation-emails.jpg', 5),
  ('Calls + Placing Sales', null, 'https://free-life-portal.vercel.app/course-covers/calls-placing-sales.jpg', 6),
  ('Follow Up + Talking to Leads', null, 'https://free-life-portal.vercel.app/course-covers/follow-up-leads.jpg', 7),
  ('Know Your Numbers', null, 'https://free-life-portal.vercel.app/course-covers/know-your-numbers.jpg', 8),
  ('Mindset + Personal Development', null, 'https://free-life-portal.vercel.app/course-covers/mindset-personal-development.jpg', 9),
  ('Mindset 101 with Adrian Wesley', 'With Adrian Wesley.', 'https://free-life-portal.vercel.app/course-covers/mindset-101.jpg', 10),
  ('Offline Sales', null, 'https://free-life-portal.vercel.app/course-covers/offline-sales.jpg', 11),
  ('Sales Summit Training', 'With Keala Kanae.', 'https://free-life-portal.vercel.app/course-covers/sales-summit.jpg', 12),
  ('Straight Line Persuasion with Jordan', 'With Jordan.', 'https://free-life-portal.vercel.app/course-covers/straight-line-persuasion.jpg', 13),
  ('Welcome to the Water Hub', null, 'https://free-life-portal.vercel.app/course-covers/water-hub.jpg', 14),
  ('Free Life Collective Discovery Process', null, 'https://free-life-portal.vercel.app/course-covers/discovery-process.jpg', 15),
  ('21-Day Magnetic Storytelling Challenge', 'From stuck and silent to magnetic and unforgettable, in 21 days.', 'https://free-life-portal.vercel.app/course-covers/magnetic-storytelling.jpg', 16),
  ('GHL How To''s', null, 'https://free-life-portal.vercel.app/course-covers/ghl-how-tos.jpg', 17)
) as n (title, description, cover_url, n)
 where c.title = n.title and c.cover_url is null;
notify pgrst, 'reload schema';
