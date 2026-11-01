-- Family tree: a private bubble chart each affiliate builds of their own lineage. Every bubble has a left and a right side.
-- Only the owner can see or change it; they can also switch on a link so someone else can look at a read-only copy.
create table if not exists public.family_tree_nodes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  parent_id        uuid references public.family_tree_nodes (id) on delete cascade,   -- empty means directly under the owner
  side             text not null check (side in ('left', 'right')),
  label            text not null check (char_length(btrim(label)) between 1 and 60),   -- a name or an account name
  rank             text check (rank is null or char_length(rank) <= 12),
  linked_member_id uuid references public.profiles (id) on delete set null,            -- set when chosen from the FLC community
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists family_tree_slot on public.family_tree_nodes (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), side);
create index if not exists family_tree_owner on public.family_tree_nodes (owner_id);
alter table public.family_tree_nodes enable row level security;
drop policy if exists ftn_all on public.family_tree_nodes;
create policy ftn_all on public.family_tree_nodes for all to authenticated
  using (owner_id = auth.uid() and public.can_see('member')) with check (owner_id = auth.uid() and public.can_see('member'));

create or replace function public.family_tree_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null and not exists (select 1 from public.family_tree_nodes p where p.id = new.parent_id and p.owner_id = new.owner_id) then
      raise exception 'that bubble is not in your tree' using errcode = '23514';
    end if;
    if (select count(*) from public.family_tree_nodes where owner_id = new.owner_id) >= 600 then
      raise exception 'a tree can hold up to 600 bubbles' using errcode = '23514';
    end if;
  else
    if new.owner_id is distinct from old.owner_id or new.parent_id is distinct from old.parent_id or new.side is distinct from old.side then
      raise exception 'a bubble cannot be moved' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists family_tree_guard on public.family_tree_nodes;
create trigger family_tree_guard before insert or update on public.family_tree_nodes for each row execute function public.family_tree_guard();

-- the share link
create table if not exists public.family_trees (
  owner_id    uuid primary key references public.profiles (id) on delete cascade,
  share_token text unique check (share_token is null or char_length(share_token) = 64),
  updated_at  timestamptz not null default now()
);
alter table public.family_trees enable row level security;
drop policy if exists ft_read on public.family_trees;
create policy ft_read on public.family_trees for select to authenticated using (owner_id = auth.uid());

-- turns the link on (returns it) or off. Turning it on again after off gives a brand new link.
create or replace function public.set_tree_sharing(p_on boolean) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); tok text;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_on then
    select share_token into tok from public.family_trees where owner_id = me;
    if tok is null then
      tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      insert into public.family_trees (owner_id, share_token) values (me, tok)
        on conflict (owner_id) do update set share_token = excluded.share_token, updated_at = now();
    end if;
    return tok;
  end if;
  update public.family_trees set share_token = null, updated_at = now() where owner_id = me;
  return null;
end $$;
revoke all on function public.set_tree_sharing(boolean) from public, anon;
grant execute on function public.set_tree_sharing(boolean) to authenticated;

-- anyone with the link can read the tree (names and ranks as typed, nothing else)
create or replace function public.shared_tree(p_token text)
returns table (owner_name text, id uuid, parent_id uuid, side text, label text, rank text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'A member'), n.id, n.parent_id, n.side, n.label, n.rank
    from public.family_trees t
    join public.profiles p on p.id = t.owner_id and p.removed_at is null
    left join public.family_tree_nodes n on n.owner_id = t.owner_id
   where char_length(coalesce(p_token, '')) = 64 and t.share_token = p_token
   order by n.created_at
$$;
revoke all on function public.shared_tree(text) from public;
grant execute on function public.shared_tree(text) to anon, authenticated;

insert into public.reserved_usernames (username) values ('family-tree'), ('familytree'), ('tree'), ('call-closers'), ('callclosers') on conflict do nothing;
notify pgrst, 'reload schema';
