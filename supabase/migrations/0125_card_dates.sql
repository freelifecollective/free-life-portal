-- Lead cards show when the lead was added (never changes) and when the follow-up is due. A new card gets a due date of today + its follow-up days (3 unless changed).
create or replace function public.lead_cards_before() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare ln text; n integer;
begin
  if tg_op = 'INSERT' then new.follow_up_on := coalesce(new.follow_up_on, current_date + new.follow_up_days); end if;
  if tg_op = 'INSERT' or new.list_id is distinct from old.list_id then
    select name into ln from public.lead_lists where id = new.list_id;
    n := (regexp_match(coalesce(ln, ''), 'circle back in (\d{1,3}) days', 'i'))[1]::integer;
    new.resume_on := case when n is not null then current_date + n else null end;
  end if;
  return new;
end $$;

-- cards that were added before this get their due date too
update public.lead_cards set follow_up_on = created_at::date + follow_up_days where follow_up_on is null;

-- Every hour: a card in Follow Up Set whose date has come moves to Follow Up Due (the date stays, so it shows red). A circle-back countdown that ended moves the card to Follow Up Due, due today.
create or replace function public.queue_lead_followups() returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; c record;
begin
  for c in
    select lc.id, lc.user_id, lc.name, lc.resume_on, x.name as list_name
      from public.lead_cards lc join public.lead_lists x on x.id = lc.list_id
      join public.profiles p on p.id = lc.user_id and p.removed_at is null
     where lc.affiliated_at is null
       and ((lc.resume_on is not null and lc.resume_on <= current_date) or (lc.follow_up_on is not null and lc.follow_up_on <= current_date and x.name ilike 'follow up set%'))
  loop
    if public.lead_move_to(c.id, 'follow up due%') then
      update public.lead_cards set resume_on = null, follow_up_on = case when c.resume_on is not null then current_date else follow_up_on end where id = c.id;
      perform public.notify_user(c.user_id, 'lead_followup', 'Follow up with ' || c.name || ' is due', 'Open Lead Tracking to see who is waiting for you.', '/tracking/leads');
      n := n + 1;
    else
      update public.lead_cards set resume_on = null where id = c.id;
    end if;
  end loop;
  return n;
end $$;
