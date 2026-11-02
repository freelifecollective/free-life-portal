-- Calls held inside the portal: the lead and their coach (or the call closer) meet in a video room on the site. The portal sees when both are really
-- there and talking, marks the call as completed by itself, records the coaching call, and (for a call closer) adds the call price to what they are owed.
alter table public.booked_calls add column if not exists completed_at timestamptz;
alter table public.booked_calls add column if not exists auto_completed boolean not null default false;
alter table public.booked_calls add column if not exists together_secs integer not null default 0;
alter table public.booked_calls add column if not exists together_checked_at timestamptz;
alter table public.booked_calls add column if not exists google_event_id text;

-- who has the room open right now (only the functions below touch it)
create table if not exists public.call_presence (
  booked_call_id uuid not null references public.booked_calls (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  last_seen      timestamptz not null default now(),
  primary key (booked_call_id, user_id)
);
alter table public.call_presence enable row level security;
revoke all on public.call_presence from public, anon, authenticated;

-- one call, as the person opening its room sees it: you are either the lead or the host (the call closer if there is one, otherwise the coach)
create or replace function public.room_info(p_call uuid)
returns table (id uuid, starts_at timestamptz, minutes integer, my_role text, other_name text, other_avatar text, completed boolean, open_now boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select b.id, b.starts_at, coalesce(cs.call_minutes, 30)::int,
         case when auth.uid() = b.lead_id then 'lead' else 'host' end,
         nullif(btrim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, '')), ''), o.avatar_url,
         b.completed_at is not null,
         now() between b.starts_at - interval '15 minutes' and b.starts_at + make_interval(mins => coalesce(cs.call_minutes, 30)) + interval '90 minutes'
    from public.booked_calls b
    left join public.coach_settings cs on cs.member_id = coalesce(b.closer_id, b.member_id)
    left join public.profiles o on o.id = case when auth.uid() = b.lead_id then coalesce(b.closer_id, b.member_id) else b.lead_id end
   where b.id = p_call and auth.uid() is not null and auth.uid() in (b.lead_id, coalesce(b.closer_id, b.member_id))
$$;
revoke all on function public.room_info(uuid) from public, anon;
grant execute on function public.room_info(uuid) to authenticated;

-- called every 20 seconds by each person while they are connected to the other. When they have been connected together for 5 minutes, the call counts.
create or replace function public.room_beat(p_call uuid) returns table (together integer, completed boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); b public.booked_calls; host uuid; other uuid; mins integer; el integer; need integer := 300; price integer; closer boolean; nm text;
begin
  select * into b from public.booked_calls where id = p_call for update;
  if b.id is null then return; end if;
  host := coalesce(b.closer_id, b.member_id);
  if me is null or me not in (b.lead_id, host) then raise exception 'not your call' using errcode = '42501'; end if;
  select coalesce(call_minutes, 30) into mins from public.coach_settings where member_id = host;
  mins := coalesce(mins, 30);
  if now() not between b.starts_at - interval '15 minutes' and b.starts_at + make_interval(mins => mins) + interval '90 minutes' then
    return query select b.together_secs, b.completed_at is not null; return;
  end if;
  insert into public.call_presence (booked_call_id, user_id, last_seen) values (p_call, me, now())
    on conflict (booked_call_id, user_id) do update set last_seen = now();
  other := case when me = b.lead_id then host else b.lead_id end;
  if b.completed_at is null then
    if exists (select 1 from public.call_presence where booked_call_id = p_call and user_id = other and last_seen > now() - interval '45 seconds') then
      el := least(greatest(floor(extract(epoch from now() - coalesce(b.together_checked_at, now())))::int, 0), 45);
      b.together_secs := b.together_secs + el;
    end if;
    update public.booked_calls set together_secs = b.together_secs, together_checked_at = now() where id = p_call;
    need := least(need, greatest(60, mins * 60 / 4));
    if b.together_secs >= need then
      closer := b.closer_id is not null and b.closer_id <> b.member_id;
      if closer then select d.price_per_call_cents into price from public.call_closer_details d where d.member_id = b.closer_id; end if;
      update public.booked_calls set completed_at = now(), auto_completed = true,
             outcome = coalesce(outcome, 'took_place'),
             pay_call_cents = case when closer and outcome is null then coalesce(price, 0) else pay_call_cents end,
             pay_currency = case when closer and outcome is null then coalesce(pay_currency, 'USD') else pay_currency end
       where id = p_call;
      b.completed_at := now();
      insert into public.milestone_events (member_id, kind, happened_on, note) values (host, 'coaching', current_date, 'Call held in the portal');
      select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'A lead') into nm from public.profiles where id = b.lead_id;
      if closer and coalesce(price, 0) > 0 then
        perform public.notify_user(host, 'announcement', 'Call completed: ' || nm, 'It was added to what you are owed.', '/call-closer');
      else
        perform public.notify_user(host, 'announcement', 'Call completed: ' || nm, 'Your call counted as a coaching call.', '/');
      end if;
    end if;
  end if;
  return query select b.together_secs, b.completed_at is not null;
end $$;
revoke all on function public.room_beat(uuid) from public, anon;
grant execute on function public.room_beat(uuid) to authenticated;
notify pgrst, 'reload schema';
