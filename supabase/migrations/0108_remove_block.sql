-- Removing and blocking people from the portal, and remembering why.

alter table public.profiles
  add column removal_reason text check (removal_reason in ('cancelled', 'unpaid', 'manual', 'blocked')),
  add column removal_note text check (removal_note is null or char_length(removal_note) <= 500);

create table public.blocked_emails (
  email      citext primary key,
  name       text,
  reason     text,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users (id) on delete set null
);
alter table public.blocked_emails enable row level security;
create policy blocked_admin on public.blocked_emails for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A blocked email can never be invited again, and can never open an account.
create or replace function public.skip_blocked_invites() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.blocked_emails b where b.email = new.email) then return null; end if;
  return new;
end $$;
create trigger skip_blocked_invites before insert on public.signup_allowlist
  for each row execute function public.skip_blocked_invites();

create or replace function public.enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  if new.email is not null and exists (select 1 from public.blocked_emails b where b.email = lower(new.email)::citext) then
    raise exception 'signups_closed' using errcode = 'P0001', hint = 'This email is blocked.';
  end if;
  if new.email is not null and exists (select 1 from public.signup_allowlist a where a.email = lower(new.email)::citext) then return new; end if;
  raise exception 'signups_closed' using errcode = 'P0001', hint = 'This email has not been invited.';
end $$;

-- Remove someone from the portal (and, if asked, block their email for good). Admins only.
create or replace function public.admin_remove_person(p_id uuid, p_reason text, p_note text, p_block boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare p public.profiles;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_id = auth.uid() then raise exception 'you cannot remove yourself' using errcode = '42501'; end if;
  select * into p from public.profiles where id = p_id;
  if not found then raise exception 'no such person' using errcode = 'P0002'; end if;
  if p.role = 'admin' then raise exception 'change them to a member first' using errcode = '42501'; end if;
  if not p_block and p_reason not in ('cancelled', 'unpaid', 'manual') then raise exception 'choose why' using errcode = '22023'; end if;
  if p_reason = 'manual' and not p_block and char_length(btrim(coalesce(p_note, ''))) = 0 then raise exception 'say why' using errcode = '22023'; end if;
  update public.profiles
     set removed_at = now(), removal_reason = case when p_block then 'blocked' else p_reason end,
         removal_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where id = p_id;
  -- they must be invited again to come back
  delete from public.signup_allowlist where email = p.email;
  if p_block and p.email is not null then
    insert into public.blocked_emails (email, name, reason, blocked_by)
    values (p.email, nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), nullif(left(btrim(coalesce(p_note, '')), 500), ''), auth.uid())
    on conflict (email) do nothing;
  end if;
  -- stop them signing in (the real auth table has this column)
  begin
    execute 'update auth.users set banned_until = ''infinity'' where id = $1' using p_id;
  exception when undefined_column then null;
  end;
end $$;
revoke all on function public.admin_remove_person(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_remove_person(uuid, text, text, boolean) to authenticated;

-- Bring a removed person back (they are being invited again). Not possible for a blocked email.
create or replace function public.admin_restore_person(p_email text, p_role public.app_role)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare p public.profiles;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if exists (select 1 from public.blocked_emails b where b.email = lower(p_email)::citext) then return false; end if;
  select * into p from public.profiles where email = lower(p_email)::citext and removed_at is not null;
  if not found then return true; end if;
  update public.profiles set removed_at = null, removal_reason = null, removal_note = null, unpaid_since = null, role = p_role where id = p.id;
  begin
    execute 'update auth.users set banned_until = null where id = $1' using p.id;
  exception when undefined_column then null;
  end;
  return true;
end $$;
revoke all on function public.admin_restore_person(text, public.app_role) from public, anon;
grant execute on function public.admin_restore_person(text, public.app_role) to authenticated;

-- Everyone who has left, for the Past members list.
create or replace function public.admin_past_people()
returns table (id uuid, first_name text, last_name text, email text, role public.app_role, created_at timestamptz, removed_at timestamptz, unpaid_since date, reason text, note text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.email::text, p.role, p.created_at, p.removed_at, p.unpaid_since,
         case when p.removed_at is not null then coalesce(p.removal_reason, 'manual') else 'unpaid' end, p.removal_note
    from public.profiles p
   where public.is_admin() and p.onboarded_at is not null
     and (p.removed_at is not null or (p.role in ('member', 'admin') and p.unpaid_since is not null and p.unpaid_since <= (current_date - interval '2 months')::date))
   order by coalesce(p.removed_at, p.unpaid_since::timestamptz) desc
   limit 2000
$$;
revoke all on function public.admin_past_people() from public, anon;
grant execute on function public.admin_past_people() to authenticated;
