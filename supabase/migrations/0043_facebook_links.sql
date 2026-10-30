-- Facebook can be a handle or a full facebook.com link (business pages often have long names with numbers).
alter table public.profiles drop constraint if exists profiles_facebook_fmt;
alter table public.profiles add constraint profiles_facebook_fmt
  check (facebook is null or facebook ~ '^[A-Za-z0-9.]{5,50}$' or facebook ~ '^https://www\.facebook\.com/(profile\.php\?id=[0-9]{1,30}|[A-Za-z0-9._~%/-]{1,200})$');
alter table public.landing_pages drop constraint if exists landing_facebook_fmt;
alter table public.landing_pages add constraint landing_facebook_fmt
  check (facebook is null or facebook = '' or facebook ~ '^[A-Za-z0-9.]{5,50}$' or facebook ~ '^https://www\.facebook\.com/(profile\.php\?id=[0-9]{1,30}|[A-Za-z0-9._~%/-]{1,200})$');
