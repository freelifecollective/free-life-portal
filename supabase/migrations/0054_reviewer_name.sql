-- A past review can come from someone who is not in the portal (a former FLC member): the admin types their name instead.
alter table public.closer_reviews alter column reviewer_id drop not null;
alter table public.closer_reviews add column if not exists reviewer_name text check (reviewer_name is null or char_length(btrim(reviewer_name)) between 1 and 80);
alter table public.closer_reviews drop constraint if exists closer_reviews_who;
alter table public.closer_reviews add constraint closer_reviews_who check (reviewer_id is not null or (reviewer_name is not null and imported));
