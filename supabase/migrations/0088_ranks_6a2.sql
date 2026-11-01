-- Phase 119: the ranks in Your Organization now run 6A2-3 up to 6A2-8 (6A2-3+ was "6A2-3 and above").
update public.family_tree_nodes set rank = '6A2-3' where rank = '6A2-3+';
update public.family_charts set root_rank = '6A2-3' where root_rank = '6A2-3+';
