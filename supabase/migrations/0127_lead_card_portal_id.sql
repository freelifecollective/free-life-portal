-- the card's portal account id too, so "Send Message" can open the chat window on the board itself
drop function if exists public.lead_card_portal_users();
create function public.lead_card_portal_users() returns table (card_id uuid, username text, profile_id uuid)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, p.username::text, p.id
    from public.lead_cards c join public.profiles p on lower(p.email::text) = lower(c.email)
   where c.user_id = auth.uid() and public.can_see('member') and c.affiliated_at is null and p.removed_at is null and p.username is not null and p.onboarded_at is not null and p.id <> auth.uid()
$$;
revoke all on function public.lead_card_portal_users() from public, anon;
grant execute on function public.lead_card_portal_users() to authenticated;
