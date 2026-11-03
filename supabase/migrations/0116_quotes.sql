-- Quotes a distributor makes for a lead (from the Earnings Estimator). Each has a long random link that anyone can open, nothing more.
create table public.quotes (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 8000),
  created_at timestamptz not null default now()
);
create index quotes_user_idx on public.quotes (user_id, created_at desc);
alter table public.quotes enable row level security;
create policy q_insert on public.quotes for insert to authenticated with check (user_id = auth.uid() and public.can_see('member'));
create policy q_read on public.quotes for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy q_delete on public.quotes for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- whoever has the link can see that one quote
create or replace function public.get_quote(p_token text) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$ select q.data from public.quotes q where q.token = p_token and char_length(p_token) between 20 and 64 $$;
revoke all on function public.get_quote(text) from public;
grant execute on function public.get_quote(text) to anon, authenticated;
