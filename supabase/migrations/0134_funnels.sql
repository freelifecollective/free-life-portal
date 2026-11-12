-- Funnels (Builder and Leader): pages built from sections, rows, columns and elements, in as many steps as the member wants.
-- The page itself is kept as one JSON document per step (see src/lib/funnels/types.ts). Public at /f/<username>/<funnel>/<step>.

create table public.funnels (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  slug       text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index funnels_owner_idx on public.funnels (owner_id);

create table public.funnel_steps (
  id         uuid primary key default gen_random_uuid(),
  funnel_id  uuid not null references public.funnels (id) on delete cascade,
  position   integer not null check (position between 0 and 99),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  slug       text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
  page       jsonb not null default '{"version":1,"settings":{},"sections":[]}',
  updated_at timestamptz not null default now(),
  unique (funnel_id, slug),
  constraint funnel_page_shape check (jsonb_typeof(page) = 'object' and coalesce(jsonb_typeof(page -> 'sections'), '') = 'array' and pg_column_size(page) < 400000)
);
create index funnel_steps_funnel_idx on public.funnel_steps (funnel_id, position);

-- people who filled in a form on a funnel page: they belong to the funnel's owner
create table public.funnel_submissions (
  id         uuid primary key default gen_random_uuid(),
  funnel_id  uuid not null references public.funnels (id) on delete cascade,
  step_id    uuid references public.funnel_steps (id) on delete set null,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  fields     jsonb not null check (jsonb_typeof(fields) = 'object' and pg_column_size(fields) < 8000),
  created_at timestamptz not null default now()
);
create index funnel_submissions_owner_idx on public.funnel_submissions (owner_id, created_at desc);

alter table public.funnels enable row level security;
alter table public.funnel_steps enable row level security;
alter table public.funnel_submissions enable row level security;

-- the owner always sees their own funnels (also after moving down a plan); building and changing them needs Builder or Leader
create policy funnels_read on public.funnels for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy funnels_write on public.funnels for insert to authenticated with check (owner_id = auth.uid() and public.plan_at_least(97::smallint));
create policy funnels_change on public.funnels for update to authenticated
  using (owner_id = auth.uid() and public.plan_at_least(97::smallint)) with check (owner_id = auth.uid() and public.plan_at_least(97::smallint));
create policy funnels_remove on public.funnels for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

create or replace function public.owns_funnel(p_funnel uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.funnels f where f.id = p_funnel and f.owner_id = auth.uid()) $$;
revoke all on function public.owns_funnel(uuid) from public, anon;
grant execute on function public.owns_funnel(uuid) to authenticated;

create policy steps_read on public.funnel_steps for select to authenticated using (public.owns_funnel(funnel_id) or public.is_admin());
create policy steps_write on public.funnel_steps for insert to authenticated with check (public.owns_funnel(funnel_id) and public.plan_at_least(97::smallint));
create policy steps_change on public.funnel_steps for update to authenticated
  using (public.owns_funnel(funnel_id) and public.plan_at_least(97::smallint)) with check (public.owns_funnel(funnel_id) and public.plan_at_least(97::smallint));
create policy steps_remove on public.funnel_steps for delete to authenticated using (public.owns_funnel(funnel_id) and public.plan_at_least(97::smallint));

create policy submissions_read on public.funnel_submissions for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy submissions_remove on public.funnel_submissions for delete to authenticated using (owner_id = auth.uid());

-- a funnel page for anyone: only while its owner is on Builder or Leader
create or replace function public.public_funnel_step(p_username text, p_funnel text, p_step text) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with f as (
    select fu.id, fu.name, p.id as owner_id
      from public.funnels fu join public.profiles p on p.id = fu.owner_id
     where p.username = lower(btrim(p_username))::citext and fu.slug = lower(btrim(p_funnel)) and public.has_builder(p.id)
  ), steps as (
    select s.id, s.slug, s.name, s.position, s.page from public.funnel_steps s join f on f.id = s.funnel_id
  ), cur as (
    select * from steps where p_step is null or p_step = '' or slug = lower(btrim(p_step)) order by (slug = lower(btrim(coalesce(p_step, '')))) desc, position limit 1
  )
  select jsonb_build_object(
    'funnel_id', f.id, 'funnel_name', f.name,
    'step_id', cur.id, 'step_slug', cur.slug, 'step_name', cur.name, 'page', cur.page,
    'next_slug', (select s.slug from steps s where s.position > cur.position order by s.position limit 1))
  from f, cur
$$;
revoke all on function public.public_funnel_step(text, text, text) from public;
grant execute on function public.public_funnel_step(text, text, text) to anon, authenticated;

-- a form on a funnel page was filled in (anyone may do this, but only on a live funnel and with a short list of fields)
create or replace function public.submit_funnel_form(p_funnel uuid, p_step uuid, p_fields jsonb) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  select fu.owner_id into v_owner from public.funnels fu join public.funnel_steps s on s.funnel_id = fu.id
   where fu.id = p_funnel and s.id = p_step and public.has_builder(fu.owner_id);
  if v_owner is null then return false; end if;
  if jsonb_typeof(p_fields) <> 'object' or pg_column_size(p_fields) >= 8000
     or exists (select 1 from jsonb_each(p_fields) e where jsonb_typeof(e.value) <> 'string' or char_length(e.key) > 40 or char_length(e.value #>> '{}') > 1000)
     or (select count(*) from jsonb_object_keys(p_fields)) > 20 then
    return false;
  end if;
  insert into public.funnel_submissions (funnel_id, step_id, owner_id, fields) values (p_funnel, p_step, v_owner, p_fields);
  return true;
end $$;
revoke all on function public.submit_funnel_form(uuid, uuid, jsonb) from public;
grant execute on function public.submit_funnel_form(uuid, uuid, jsonb) to anon, authenticated;
