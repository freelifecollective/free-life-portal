-- Phase 112: Your Organization: each side of an account can hold as many accounts as you like (it was one per side).
drop index if exists public.family_tree_slot;
create index if not exists family_tree_parent on public.family_tree_nodes (owner_id, parent_id, side, created_at);
notify pgrst, 'reload schema';
