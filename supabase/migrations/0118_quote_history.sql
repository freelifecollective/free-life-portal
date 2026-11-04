-- Quotes already sent: a list on the Create a Quote page, and a nudge to follow up 3, 7 and 10 days after a quote went out.
alter table public.quotes
  add column sent_at timestamptz not null default now(),
  add column lead_email text check (lead_email is null or char_length(lead_email) <= 254),
  add column followup_done boolean not null default false,
  add column nudges smallint not null default 0 check (nudges between 0 and 3);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_lead', 'call_reminder', 'call_new', 'submission_result', 'announcement', 'important_update', 'direct_message', 'payment', 'outsourcing', 'accountability', 'recording', 'task', 'chat_message', 'quote_followup'));

-- emailing a quote also remembers who it went to
create or replace function public.queue_quote_email(p_token text, p_to text, p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me public.profiles; n integer; t text := lower(btrim(p_to));
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  select * into me from public.profiles where id = auth.uid();
  if not exists (select 1 from public.quotes q where q.token = p_token and q.user_id = auth.uid()) then raise exception 'not your quote' using errcode = '42501'; end if;
  if t !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or char_length(t) > 254 then raise exception 'bad email' using errcode = '22023'; end if;
  select count(*) into n from public.email_outbox o where o.template = 'quote_share' and o.payload->>'from_id' = auth.uid()::text and o.created_at > now() - interval '1 day';
  if n >= 30 then raise exception 'too many emails today' using errcode = '54000'; end if;
  insert into public.email_outbox (to_email, template, payload)
  values (t, 'quote_share', jsonb_build_object('name', left(btrim(coalesce(p_name, '')), 60), 'token', p_token, 'from_id', auth.uid(),
          'from_name', btrim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')), 'reply_to', me.email));
  update public.quotes set lead_email = t, sent_at = now(), nudges = 0, followup_done = false where token = p_token and user_id = auth.uid();
end $$;

-- mark a quote as followed up (the nudges stop) or open again
create or replace function public.set_quote_followed_up(p_token text, p_done boolean) returns void
language sql security definer set search_path = public, pg_temp
as $$ update public.quotes set followup_done = p_done where token = p_token and user_id = auth.uid() $$;
revoke all on function public.set_quote_followed_up(text, boolean) from public, anon;
grant execute on function public.set_quote_followed_up(text, boolean) to authenticated;

-- Nudges: 3, 7 and 10 days after a quote was sent (9am in the person's own time or later), until they mark it followed up.
-- If a day was missed, only the latest nudge is sent. Run every hour.
create or replace function public.queue_quote_followups() returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer := 0; r record; local_now timestamp; age numeric; step smallint; who text;
begin
  for r in
    select q.token, q.user_id, q.data, q.sent_at, q.nudges, coalesce(mp.tz, 'America/New_York') as zone
      from public.quotes q
      join public.profiles p on p.id = q.user_id and p.removed_at is null and p.role in ('member', 'admin')
      left join public.member_prefs mp on mp.member_id = q.user_id
     where not q.followup_done and q.nudges < 3 and q.sent_at <= now() - interval '3 days'
  loop
    begin local_now := now() at time zone r.zone; exception when others then local_now := now() at time zone 'America/New_York'; end;
    if extract(hour from local_now) < 9 then continue; end if;
    age := extract(epoch from (now() - r.sent_at)) / 86400;
    step := case when age >= 10 then 3 when age >= 7 then 2 when age >= 3 then 1 else 0 end;
    if step <= r.nudges then continue; end if;
    who := coalesce(nullif(btrim(r.data->>'lead'), ''), 'your lead');
    update public.quotes set nudges = step where token = r.token;
    perform public.notify_user(r.user_id, 'quote_followup',
      'Follow up with ' || who || ' about their quote',
      'You sent it ' || (case step when 1 then '3' when 2 then '7' else '10' end) || ' days ago. A friendly message can help them take the next step.',
      '/create-quote?quotes=1');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.queue_quote_followups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('flc-quote-followups', '7 * * * *', 'select public.queue_quote_followups()');
  end if;
exception when others then
  raise notice 'pg_cron could not be set up: %', sqlerrm;
end $$;
