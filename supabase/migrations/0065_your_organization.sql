-- Your Organization (the family tree): the top bubble can be edited, and a bubble can be marked as one of your own accounts.
alter table public.family_tree_nodes add column if not exists owned boolean not null default false;
alter table public.family_trees add column if not exists root_label text check (root_label is null or char_length(btrim(root_label)) between 1 and 60);
alter table public.family_trees add column if not exists root_rank text check (root_rank is null or char_length(root_rank) <= 12);

-- change the top bubble's name and rank (empty means use the profile name and rank)
create or replace function public.save_tree_root(p_label text, p_rank text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  insert into public.family_trees (owner_id, root_label, root_rank) values (me, nullif(left(btrim(coalesce(p_label, '')), 60), ''), nullif(left(btrim(coalesce(p_rank, '')), 12), ''))
    on conflict (owner_id) do update set root_label = excluded.root_label, root_rank = excluded.root_rank, updated_at = now();
end $$;
revoke all on function public.save_tree_root(text, text) from public, anon;
grant execute on function public.save_tree_root(text, text) to authenticated;

drop function if exists public.shared_tree(text);
create function public.shared_tree(p_token text)
returns table (owner_name text, root_rank text, id uuid, parent_id uuid, side text, label text, rank text, owned boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(t.root_label, nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'A member'), t.root_rank,
         n.id, n.parent_id, n.side, n.label, n.rank, n.owned
    from public.family_trees t
    join public.profiles p on p.id = t.owner_id and p.removed_at is null
    left join public.family_tree_nodes n on n.owner_id = t.owner_id
   where char_length(coalesce(p_token, '')) = 64 and t.share_token = p_token
   order by n.created_at
$$;
revoke all on function public.shared_tree(text) from public;
grant execute on function public.shared_tree(text) to anon, authenticated;

insert into public.reserved_usernames (username) values ('your-organization'), ('yourorganization'), ('organization') on conflict do nothing;
notify pgrst, 'reload schema';
