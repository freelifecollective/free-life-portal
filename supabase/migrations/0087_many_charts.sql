-- Phase 117: Your Organization can have as many charts as you like (for example your real organization and a vision board),
-- and accounts can be copied from one chart to another.
create table if not exists public.family_charts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  root_label  text check (root_label is null or char_length(btrim(root_label)) between 1 and 60),
  root_rank   text check (root_rank is null or char_length(root_rank) <= 12),
  share_token text unique check (share_token is null or char_length(share_token) = 64),
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists family_charts_owner on public.family_charts (owner_id, sort, created_at);
alter table public.family_charts enable row level security;
drop policy if exists fc_own on public.family_charts;
create policy fc_own on public.family_charts for select to authenticated using (owner_id = auth.uid());   -- changes go through the functions below

-- what already exists becomes the first chart (the share link keeps working)
insert into public.family_charts (owner_id, name, root_label, root_rank, share_token)
  select t.owner_id, 'My organization', t.root_label, t.root_rank, t.share_token from public.family_trees t
   where not exists (select 1 from public.family_charts c where c.owner_id = t.owner_id);
insert into public.family_charts (owner_id, name)
  select distinct n.owner_id, 'My organization' from public.family_tree_nodes n
   where not exists (select 1 from public.family_charts c where c.owner_id = n.owner_id);

alter table public.family_tree_nodes add column if not exists chart_id uuid references public.family_charts (id) on delete cascade;
update public.family_tree_nodes n set chart_id = (select c.id from public.family_charts c where c.owner_id = n.owner_id order by c.sort, c.created_at limit 1) where n.chart_id is null;
alter table public.family_tree_nodes alter column chart_id set not null;
create index if not exists family_tree_nodes_chart on public.family_tree_nodes (chart_id, parent_id, side, created_at);

create or replace function public.family_tree_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    /* no chart given: it goes in the owner's first chart (made if they have none) */
    if new.chart_id is null then
      select id into new.chart_id from public.family_charts where owner_id = new.owner_id order by sort, created_at limit 1;
      if new.chart_id is null then insert into public.family_charts (owner_id, name) values (new.owner_id, 'My organization') returning id into new.chart_id; end if;
    end if;
    if not exists (select 1 from public.family_charts c where c.id = new.chart_id and c.owner_id = new.owner_id) then
      raise exception 'that chart is not yours' using errcode = '23514';
    end if;
    if new.parent_id is not null and not exists (select 1 from public.family_tree_nodes p where p.id = new.parent_id and p.owner_id = new.owner_id and p.chart_id = new.chart_id) then
      raise exception 'that bubble is not in this chart' using errcode = '23514';
    end if;
    if (select count(*) from public.family_tree_nodes where chart_id = new.chart_id) >= 600 then
      raise exception 'a chart can hold up to 600 bubbles' using errcode = '23514';
    end if;
  else
    if new.owner_id is distinct from old.owner_id or new.chart_id is distinct from old.chart_id then
      raise exception 'a bubble cannot change chart' using errcode = '23514';
    end if;
    if (new.parent_id is distinct from old.parent_id or new.side is distinct from old.side) and coalesce(current_setting('flc.moving', true), '') <> 'on' then
      raise exception 'a bubble cannot be moved' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- a bubble can only be moved within its own chart
create or replace function public.move_tree_node(p_id uuid, p_parent uuid, p_side text, p_after uuid default null, p_first boolean default false) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); lo timestamptz; hi timestamptz; ts timestamptz := now(); ch uuid;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_side not in ('left', 'right') then raise exception 'bad side' using errcode = '22023'; end if;
  select chart_id into ch from public.family_tree_nodes where id = p_id and owner_id = me;
  if ch is null then raise exception 'not your bubble' using errcode = '42501'; end if;
  if p_parent is not null then
    if not exists (select 1 from public.family_tree_nodes where id = p_parent and owner_id = me and chart_id = ch) then raise exception 'that bubble is not in this chart' using errcode = '23514'; end if;
    if exists (
      with recursive below as (
        select id from public.family_tree_nodes where id = p_id and owner_id = me
        union all
        select n.id from public.family_tree_nodes n join below b on n.parent_id = b.id where n.owner_id = me
      ) select 1 from below where id = p_parent
    ) then raise exception 'a bubble cannot go under itself' using errcode = '23514'; end if;
  end if;
  if p_first then
    select min(created_at) into hi from public.family_tree_nodes where chart_id = ch and parent_id is not distinct from p_parent and side = p_side and id <> p_id;
    if hi is not null then ts := hi - interval '1 second'; end if;
  elsif p_after is not null then
    select created_at into lo from public.family_tree_nodes where id = p_after and chart_id = ch and parent_id is not distinct from p_parent and side = p_side and id <> p_id;
    if lo is not null then
      select min(created_at) into hi from public.family_tree_nodes where chart_id = ch and parent_id is not distinct from p_parent and side = p_side and id <> p_id and created_at > lo;
      ts := case when hi is null then greatest(now(), lo + interval '1 millisecond') else lo + (hi - lo) / 2 end;
    end if;
  end if;
  perform set_config('flc.moving', 'on', true);
  update public.family_tree_nodes set parent_id = p_parent, side = p_side, created_at = ts where id = p_id and owner_id = me;
  perform set_config('flc.moving', 'off', true);
end $$;

-- copies a bubble (and, if asked, everything under it) into a chart, under a bubble there or under the top. Used for new charts and for "copy to another chart".
create or replace function public.copy_nodes_into(p_owner uuid, p_src_chart uuid, p_start uuid, p_dest uuid, p_dest_parent uuid, p_side text, p_below boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; nid uuid; first_new uuid; map jsonb := '{}'::jsonb;
begin
  for r in
    with recursive t as (
      select n.*, 0 as d from public.family_tree_nodes n where n.owner_id = p_owner and n.chart_id = p_src_chart and (case when p_start is null then n.parent_id is null else n.id = p_start end)
      union all
      select n.*, t.d + 1 from public.family_tree_nodes n join t on n.parent_id = t.id where p_below and n.owner_id = p_owner and n.chart_id = p_src_chart
    ) select * from t order by d, created_at
  loop
    insert into public.family_tree_nodes (owner_id, chart_id, parent_id, side, label, rank, linked_member_id, owned, created_at)
      values (p_owner, p_dest,
              case when r.d = 0 then p_dest_parent else (map ->> r.parent_id::text)::uuid end,
              case when r.d = 0 and p_side is not null then p_side else r.side end,
              r.label, r.rank, r.linked_member_id, r.owned, case when r.d = 0 then now() else r.created_at end)
      returning id into nid;
    map := map || jsonb_build_object(r.id::text, nid::text);
    if first_new is null then first_new := nid; end if;
  end loop;
  return first_new;
end $$;
revoke all on function public.copy_nodes_into(uuid, uuid, uuid, uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function public.ensure_default_chart() returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  select id into cid from public.family_charts where owner_id = me order by sort, created_at limit 1;
  if cid is null then insert into public.family_charts (owner_id, name) values (me, 'My organization') returning id into cid; end if;
  return cid;
end $$;
revoke all on function public.ensure_default_chart() from public, anon;
grant execute on function public.ensure_default_chart() to authenticated;

-- a new chart: empty, or a copy of one you already have
create or replace function public.create_chart(p_name text, p_copy_of uuid default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); cid uuid; src public.family_charts;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'name it with up to 60 characters' using errcode = '22023'; end if;
  if (select count(*) from public.family_charts where owner_id = me) >= 100 then raise exception 'that is a lot of charts' using errcode = '23514'; end if;
  if p_copy_of is not null then select * into src from public.family_charts where id = p_copy_of and owner_id = me; if src.id is null then raise exception 'not your chart' using errcode = '42501'; end if; end if;
  insert into public.family_charts (owner_id, name, root_label, root_rank, sort)
    values (me, btrim(p_name), src.root_label, src.root_rank, coalesce((select max(sort) + 1 from public.family_charts where owner_id = me), 0)) returning id into cid;
  if p_copy_of is not null then perform public.copy_nodes_into(me, p_copy_of, null, cid, null, null, true); end if;
  return cid;
end $$;
revoke all on function public.create_chart(text, uuid) from public, anon;
grant execute on function public.create_chart(text, uuid) to authenticated;

create or replace function public.rename_chart(p_chart uuid, p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'name it with up to 60 characters' using errcode = '22023'; end if;
  update public.family_charts set name = btrim(p_name), updated_at = now() where id = p_chart and owner_id = auth.uid();
end $$;
revoke all on function public.rename_chart(uuid, text) from public, anon;
grant execute on function public.rename_chart(uuid, text) to authenticated;

create or replace function public.delete_chart(p_chart uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if (select count(*) from public.family_charts where owner_id = me) <= 1 then raise exception 'keep at least one chart' using errcode = '23514'; end if;
  delete from public.family_charts where id = p_chart and owner_id = me;
end $$;
revoke all on function public.delete_chart(uuid) from public, anon;
grant execute on function public.delete_chart(uuid) to authenticated;

create or replace function public.save_chart_root(p_chart uuid, p_label text, p_rank text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  update public.family_charts set root_label = nullif(left(btrim(coalesce(p_label, '')), 60), ''), root_rank = nullif(left(btrim(coalesce(p_rank, '')), 12), ''), updated_at = now()
   where id = p_chart and owner_id = auth.uid();
end $$;
revoke all on function public.save_chart_root(uuid, text, text) from public, anon;
grant execute on function public.save_chart_root(uuid, text, text) to authenticated;

create or replace function public.set_chart_sharing(p_chart uuid, p_on boolean) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); tok text;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if not exists (select 1 from public.family_charts where id = p_chart and owner_id = me) then raise exception 'not your chart' using errcode = '42501'; end if;
  if p_on then
    select share_token into tok from public.family_charts where id = p_chart;
    if tok is null then
      tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      update public.family_charts set share_token = tok, updated_at = now() where id = p_chart;
    end if;
    return tok;
  end if;
  update public.family_charts set share_token = null, updated_at = now() where id = p_chart;
  return null;
end $$;
revoke all on function public.set_chart_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_chart_sharing(uuid, boolean) to authenticated;

-- copy one bubble (and what is under it, if asked) into another of your charts
create or replace function public.copy_tree_nodes(p_id uuid, p_chart uuid, p_parent uuid, p_side text, p_below boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); src uuid;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_side not in ('left', 'right') then raise exception 'bad side' using errcode = '22023'; end if;
  select chart_id into src from public.family_tree_nodes where id = p_id and owner_id = me;
  if src is null then raise exception 'not your bubble' using errcode = '42501'; end if;
  if not exists (select 1 from public.family_charts where id = p_chart and owner_id = me) then raise exception 'not your chart' using errcode = '42501'; end if;
  if p_parent is not null and not exists (select 1 from public.family_tree_nodes where id = p_parent and owner_id = me and chart_id = p_chart) then raise exception 'that bubble is not in that chart' using errcode = '23514'; end if;
  return public.copy_nodes_into(me, src, p_id, p_chart, p_parent, p_side, coalesce(p_below, true));
end $$;
revoke all on function public.copy_tree_nodes(uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.copy_tree_nodes(uuid, uuid, uuid, text, boolean) to authenticated;

-- the shared link now belongs to a chart
drop function if exists public.shared_tree(text);
create function public.shared_tree(p_token text)
returns table (owner_name text, root_rank text, chart_name text, id uuid, parent_id uuid, side text, label text, rank text, owned boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(c.root_label, nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'A member'), c.root_rank, c.name,
         n.id, n.parent_id, n.side, n.label, n.rank, n.owned
    from public.family_charts c
    join public.profiles p on p.id = c.owner_id and p.removed_at is null
    left join public.family_tree_nodes n on n.chart_id = c.id
   where char_length(coalesce(p_token, '')) = 64 and c.share_token = p_token
   order by n.created_at
$$;
revoke all on function public.shared_tree(text) from public;
grant execute on function public.shared_tree(text) to anon, authenticated;
notify pgrst, 'reload schema';
