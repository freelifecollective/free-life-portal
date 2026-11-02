-- Email series for new leads: a welcome the moment they register, then follow-ups one, three and ten days later.
-- Sending is done by the portal (it drains this queue) once an email service is connected.
alter table public.email_outbox add column if not exists send_after timestamptz not null default now();
alter table public.email_outbox add column if not exists series text;
alter table public.email_outbox add column if not exists step integer;
alter table public.email_outbox drop constraint if exists email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check check (status in ('pending', 'sent', 'failed', 'skipped'));
-- one email per person per step, ever
create unique index if not exists email_outbox_series_once on public.email_outbox (to_email, series, step) where series is not null;
drop index if exists public.email_outbox_pending_idx;
create index email_outbox_pending_idx on public.email_outbox (send_after) where status = 'pending';

-- people who asked to stop getting the series
create table if not exists public.email_unsubscribes (
  email citext primary key,
  created_at timestamptz not null default now()
);
alter table public.email_unsubscribes enable row level security;
drop policy if exists unsub_admin on public.email_unsubscribes;
create policy unsub_admin on public.email_unsubscribes for select to authenticated using (public.is_admin());

-- when someone registers for a call, queue their series (once, however many calls they register for)
create or replace function public.queue_lead_series() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.email is null or exists (select 1 from public.email_unsubscribes u where u.email = new.email::citext) then return new; end if;
  insert into public.email_outbox (to_email, template, payload, series, step, send_after)
    select new.email::citext, 'lead_series_' || s.step, jsonb_build_object('name', coalesce(new.first_name, ''), 'referrer_id', new.referrer_id), 'lead_welcome', s.step, now() + s.delay
      from (values (0, interval '0'), (1, interval '1 day'), (2, interval '3 days'), (3, interval '10 days')) as s (step, delay)
    on conflict do nothing;
  return new;
end $$;
revoke all on function public.queue_lead_series() from public, anon, authenticated;
drop trigger if exists registrations_series on public.registrations;
create trigger registrations_series after insert on public.registrations for each row execute function public.queue_lead_series();
notify pgrst, 'reload schema';
