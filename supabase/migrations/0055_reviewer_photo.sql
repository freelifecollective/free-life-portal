-- An optional picture for a past reviewer who is not in the portal (uploaded by an admin).
alter table public.closer_reviews add column if not exists reviewer_photo_url text check (reviewer_photo_url is null or (char_length(reviewer_photo_url) <= 500 and reviewer_photo_url ~ '^https://'));
