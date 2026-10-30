-- The "FLC Members" and "New Members" lists on the Chats screen. Only affiliates may look, and only onboarded, active people are listed.
create or replace function public.member_directory(p_kind text)
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, instagram text, facebook text, is_admin boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, p.instagram, p.facebook, p.role = 'admin'
  from public.profiles p
  where public.app_current_role() in ('member', 'admin')
    and p.onboarded_at is not null and p.removed_at is null
    and ((p_kind = 'affiliates' and p.role in ('member', 'admin') and (p.unpaid_since is null or p.unpaid_since > (current_date - interval '2 months')::date))
      or (p_kind = 'leads' and p.role = 'lead'))
  order by lower(p.first_name), lower(p.last_name)
  limit 2000
$$;
revoke all on function public.member_directory(text) from public, anon;
grant execute on function public.member_directory(text) to authenticated;
