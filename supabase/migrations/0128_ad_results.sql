-- Know Your Numbers: ad results. Each affiliate logs what they spent and how many leads it brought (by hand for now; the Meta connection can fill the same table later).
create table public.ad_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null default current_date,
  campaign   text check (campaign is null or char_length(campaign) <= 80),
  spend      numeric(10,2) not null default 0 check (spend >= 0 and spend < 10000000),
  leads      integer not null default 0 check (leads >= 0 and leads < 1000000),
  source     text not null default 'manual' check (source in ('manual', 'meta')),
  created_at timestamptz not null default now()
);
create index ad_results_user_day on public.ad_results (user_id, day desc);
alter table public.ad_results enable row level security;
create policy ad_results_own on public.ad_results for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.ad_results to authenticated;
