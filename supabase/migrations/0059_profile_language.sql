-- The language each person chose, so phone banners (and later emails) can be sent in it.
alter table public.profiles add column if not exists lang text;
alter table public.profiles drop constraint if exists profiles_lang_code;
alter table public.profiles add constraint profiles_lang_code check (lang is null or lang in ('en', 'es', 'fr', 'it', 'de'));
notify pgrst, 'reload schema';
