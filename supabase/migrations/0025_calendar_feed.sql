-- A private link for each person that Google / Apple Calendar can subscribe to.
-- The link is the only key, so it is random and can be replaced if it ever leaks.
create table public.calendar_tokens (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.calendar_tokens enable row level security;
-- no policies: only the signed-in person's function below and the server (service key) can touch it

create function public.my_calendar_token(p_reset boolean default false) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  if auth.uid() is null then return null; end if;
  if p_reset then delete from public.calendar_tokens where user_id = auth.uid(); end if;
  insert into public.calendar_tokens (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select token into t from public.calendar_tokens where user_id = auth.uid();
  return t;
end $$;
revoke all on function public.my_calendar_token(boolean) from public, anon;
grant execute on function public.my_calendar_token(boolean) to authenticated;
