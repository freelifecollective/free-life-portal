-- Builder and Leader: their own emails and texts, and automations that send them after someone fills in a funnel form.
-- Emails go into the existing email_outbox (sent by /api/email/drain once the email service is connected).
-- Texts go into sms_outbox (sent once the texting service is connected). Both are paid from the member's wallet later.

create table public.member_messages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('email', 'text')),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  subject     text check (subject is null or char_length(subject) <= 200),
  body        text not null check (char_length(body) between 1 and 10000),
  -- which ready-made message this started from, if any
  default_key text check (default_key is null or default_key ~ '^[a-z0-9_]{1,40}$'),
  updated_at  timestamptz not null default now(),
  constraint text_is_short check (kind <> 'text' or char_length(body) <= 640),
  constraint email_has_subject check (kind <> 'email' or char_length(btrim(coalesce(subject, ''))) > 0)
);
create index member_messages_owner_idx on public.member_messages (owner_id, kind);

-- steps: [{ "wait_hours": 0..8760, "message_id": uuid }, ...], up to 30
create or replace function public.automation_steps_ok(s jsonb) returns boolean language sql immutable
as $$
  select jsonb_typeof(s) = 'array' and jsonb_array_length(s) <= 30 and not exists (
    select 1 from jsonb_array_elements(s) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(jsonb_typeof(e -> 'wait_hours'), '') <> 'number' or (e ->> 'wait_hours')::numeric not between 0 and 8760
        or coalesce(e ->> 'message_id', '') !~ '^[0-9a-f-]{36}$'
        or exists (select 1 from jsonb_object_keys(e) k where k not in ('wait_hours', 'message_id')))
$$;

create table public.automations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  -- runs when a form on this funnel is filled in (null: any of the member's funnels)
  funnel_id  uuid references public.funnels (id) on delete cascade,
  steps      jsonb not null default '[]' check (public.automation_steps_ok(steps)),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
create index automations_owner_idx on public.automations (owner_id) where active;

create table public.sms_outbox (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  to_phone   text not null check (to_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  body       text not null check (char_length(body) between 1 and 640),
  status     text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts   integer not null default 0,
  error      text,
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index sms_outbox_pending_idx on public.sms_outbox (send_after) where status = 'pending';

alter table public.member_messages enable row level security;
alter table public.automations enable row level security;
alter table public.sms_outbox enable row level security;

create policy mm_read on public.member_messages for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy mm_add on public.member_messages for insert to authenticated with check (owner_id = auth.uid() and public.plan_at_least(97::smallint));
create policy mm_change on public.member_messages for update to authenticated
  using (owner_id = auth.uid() and public.plan_at_least(97::smallint)) with check (owner_id = auth.uid() and public.plan_at_least(97::smallint));
create policy mm_remove on public.member_messages for delete to authenticated using (owner_id = auth.uid());

create policy au_read on public.automations for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy au_add on public.automations for insert to authenticated
  with check (owner_id = auth.uid() and public.plan_at_least(97::smallint) and (funnel_id is null or public.owns_funnel(funnel_id)));
create policy au_change on public.automations for update to authenticated
  using (owner_id = auth.uid() and public.plan_at_least(97::smallint))
  with check (owner_id = auth.uid() and public.plan_at_least(97::smallint) and (funnel_id is null or public.owns_funnel(funnel_id)));
create policy au_remove on public.automations for delete to authenticated using (owner_id = auth.uid());

create policy sms_read on public.sms_outbox for select to authenticated using (owner_id = auth.uid() or public.is_admin());

-- {first_name} and friends in a message become the person's own details
create or replace function public.fill_message(t text, f jsonb) returns text language sql immutable
as $$
  select replace(replace(replace(coalesce(t, ''),
    '{first_name}', coalesce(nullif(f ->> 'first_name', ''), 'there')),
    '{last_name}', coalesce(f ->> 'last_name', '')),
    '{email}', coalesce(f ->> 'email', ''))
$$;

-- someone filled in a form: line up every step of the owner's matching automations
create or replace function public.run_automations() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  a record; st jsonb; m record; at timestamptz; owner record;
begin
  if not public.has_builder(new.owner_id) then return new; end if;
  select first_name, last_name, email into owner from public.profiles where id = new.owner_id;
  for a in select * from public.automations where owner_id = new.owner_id and active and (funnel_id is null or funnel_id = new.funnel_id) loop
    at := now();
    for st in select * from jsonb_array_elements(a.steps) loop
      at := at + make_interval(hours => (st ->> 'wait_hours')::numeric::int);
      select * into m from public.member_messages where id = (st ->> 'message_id')::uuid and owner_id = new.owner_id;
      continue when not found;
      if m.kind = 'email' and coalesce(new.fields ->> 'email', '') ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        insert into public.email_outbox (to_email, template, payload, send_after, series)
        values (new.fields ->> 'email', 'member_message',
          jsonb_build_object('subject', public.fill_message(m.subject, new.fields), 'body', public.fill_message(m.body, new.fields),
            'from_name', btrim(coalesce(owner.first_name, '') || ' ' || coalesce(owner.last_name, '')), 'reply_to', owner.email, 'owner_id', new.owner_id),
          at, 'member:' || new.owner_id);
      elsif m.kind = 'text' and coalesce(new.fields ->> 'phone', '') ~ '^\+?[0-9 ()-]{7,20}$' then
        insert into public.sms_outbox (owner_id, to_phone, body, send_after)
        values (new.owner_id, new.fields ->> 'phone', left(public.fill_message(m.body, new.fields), 640), at);
      end if;
    end loop;
  end loop;
  return new;
end $$;
create trigger funnel_submissions_automate after insert on public.funnel_submissions for each row execute function public.run_automations();
