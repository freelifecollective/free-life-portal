-- The call closer's own area: pause new clients (with a waiting list), record how past calls went and what the lead bought,
-- work out what is owed, and mark it paid.
alter table public.call_closer_details add column if not exists paused boolean not null default false;

create table if not exists public.closer_waitlist (
  closer_id  uuid not null references public.profiles (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (closer_id, member_id)
);
alter table public.closer_waitlist enable row level security;
drop policy if exists cw_own on public.closer_waitlist;
create policy cw_own on public.closer_waitlist for select to authenticated using (member_id = auth.uid());

alter table public.booked_calls add column if not exists outcome text check (outcome is null or outcome in ('took_place', 'no_show'));
alter table public.booked_calls add column if not exists pay_points smallint check (pay_points is null or pay_points between 1 and 8);
alter table public.booked_calls add column if not exists pay_call_cents integer check (pay_call_cents is null or pay_call_cents between 0 and 100000000);
alter table public.booked_calls add column if not exists pay_products_cents integer check (pay_products_cents is null or pay_products_cents between 0 and 100000000);
alter table public.booked_calls add column if not exists pay_currency text check (pay_currency is null or pay_currency ~ '^[A-Z]{3}$');
alter table public.booked_calls add column if not exists paid_cents integer not null default 0 check (paid_cents >= 0);
alter table public.booked_calls add column if not exists paid_at timestamptz;

create table if not exists public.booked_call_products (
  booked_call_id uuid not null references public.booked_calls (id) on delete cascade,
  product        text not null check (char_length(product) between 1 and 120),
  qty            smallint not null check (qty between 1 and 99),
  primary key (booked_call_id, product)
);
alter table public.booked_call_products enable row level security;
drop policy if exists bcp_read on public.booked_call_products;
create policy bcp_read on public.booked_call_products for select to authenticated
  using (exists (select 1 from public.booked_calls b where b.id = booked_call_id and (b.closer_id = auth.uid() or b.member_id = auth.uid() or public.is_admin())));

-- how a closer is paid for products: by the rank of the affiliate who hired them (ranks 1 to 7 = 1A to 6A+)
create table if not exists public.closer_pay_rules (
  id        uuid primary key default gen_random_uuid(),
  closer_id uuid not null references public.profiles (id) on delete cascade,
  rank_from smallint not null check (rank_from between 1 and 7),
  rank_to   smallint not null check (rank_to between 1 and 7),
  kind      text not null check (kind in ('flat', 'percent')),
  amount    numeric not null check (amount >= 0 and amount <= 100000000),   -- cents for flat, a percentage for percent
  check (rank_to >= rank_from)
);
alter table public.closer_pay_rules enable row level security;
drop policy if exists cpr_own on public.closer_pay_rules;
create policy cpr_own on public.closer_pay_rules for all to authenticated
  using ((closer_id = auth.uid() and public.is_call_closer(auth.uid())) or public.is_admin())
  with check ((closer_id = auth.uid() and public.is_call_closer(auth.uid())) or public.is_admin());
insert into public.closer_pay_rules (closer_id, rank_from, rank_to, kind, amount)
  select p.id, v.f, v.t, v.k, v.a from public.profiles p, (values (1, 3, 'flat', 5000), (4, 7, 'percent', 8)) as v(f, t, k, a)
   where p.username = 'sonyafruthven' and not exists (select 1 from public.closer_pay_rules r where r.closer_id = p.id);

-- what the closer needs to work out the pay for one of their calls
create or replace function public.closer_call_inputs(p_id uuid) returns table (member_id uuid, rank_id smallint, country text, price_per_call_cents integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select b.member_id, mp.rank_id, p.country, d.price_per_call_cents
    from public.booked_calls b
    join public.profiles p on p.id = b.member_id
    left join public.member_private mp on mp.member_id = b.member_id
    left join public.call_closer_details d on d.member_id = b.closer_id
   where b.id = p_id and b.closer_id = auth.uid()
$$;
revoke all on function public.closer_call_inputs(uuid) from public, anon;
grant execute on function public.closer_call_inputs(uuid) to authenticated;

create or replace function public.closer_save_call(p_id uuid, p_outcome text, p_points integer, p_call_cents integer, p_products_cents integer, p_currency text, p_products jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare b public.booked_calls; kv record;
begin
  select * into b from public.booked_calls where id = p_id and closer_id = auth.uid() and starts_at <= now() for update;
  if b.id is null then raise exception 'that call is not yours or has not happened yet' using errcode = '42501'; end if;
  if p_outcome not in ('took_place', 'no_show') then raise exception 'choose whether the call took place' using errcode = '22023'; end if;
  delete from public.booked_call_products where booked_call_id = p_id;
  if p_outcome = 'took_place' then
    for kv in select key as product, value::int as qty from jsonb_each_text(coalesce(p_products, '{}'::jsonb)) where value ~ '^[0-9]+$' and value::int between 1 and 99 and char_length(key) between 1 and 120 loop
      insert into public.booked_call_products (booked_call_id, product, qty) values (p_id, kv.product, kv.qty);
    end loop;
  end if;
  update public.booked_calls set outcome = p_outcome, pay_points = case when p_outcome = 'took_place' then p_points else null end,
         pay_call_cents = case when p_outcome = 'took_place' then greatest(coalesce(p_call_cents, 0), 0) else 0 end,
         pay_products_cents = case when p_outcome = 'took_place' then greatest(coalesce(p_products_cents, 0), 0) else 0 end,
         pay_currency = case when p_outcome = 'took_place' then p_currency else null end
   where id = p_id;
end $$;
revoke all on function public.closer_save_call(uuid, text, integer, integer, integer, text, jsonb) from public, anon;
grant execute on function public.closer_save_call(uuid, text, integer, integer, integer, text, jsonb) to authenticated;

-- "this has been paid to me" (or undo it)
create or replace function public.closer_mark_paid(p_id uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.booked_calls set paid_cents = case when p_paid then coalesce(pay_call_cents, 0) + coalesce(pay_products_cents, 0) else 0 end,
         paid_at = case when p_paid then now() else null end
   where id = p_id and closer_id = auth.uid() and outcome = 'took_place';
end $$;
revoke all on function public.closer_mark_paid(uuid, boolean) from public, anon;
grant execute on function public.closer_mark_paid(uuid, boolean) to authenticated;

-- stop or restart taking new clients. Restarting tells everyone on the waiting list.
create or replace function public.set_closer_paused(p_paused boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); was boolean; nm text; w record;
begin
  if me is null or not public.is_call_closer(me) then raise exception 'call closers only' using errcode = '42501'; end if;
  select coalesce(paused, false) into was from public.call_closer_details where member_id = me;
  insert into public.call_closer_details (member_id, paused) values (me, p_paused) on conflict (member_id) do update set paused = excluded.paused, updated_at = now();
  if coalesce(was, false) and not p_paused then
    select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'A call closer') into nm from public.profiles where id = me;
    for w in select member_id from public.closer_waitlist where closer_id = me loop
      perform public.notify_user(w.member_id, 'announcement', nm || ' is booking again', 'Open Call Closers for Hire to ask them to take your calls.', '/call-closers');
    end loop;
    delete from public.closer_waitlist where closer_id = me;
  end if;
end $$;
revoke all on function public.set_closer_paused(boolean) from public, anon;
grant execute on function public.set_closer_paused(boolean) to authenticated;

create or replace function public.closer_waitlist_toggle(p_closer uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.can_see('member') or not public.is_call_closer(p_closer) or p_closer = me then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.closer_waitlist where closer_id = p_closer and member_id = me) then
    delete from public.closer_waitlist where closer_id = p_closer and member_id = me;
    return false;
  end if;
  insert into public.closer_waitlist (closer_id, member_id) values (p_closer, me);
  return true;
end $$;
revoke all on function public.closer_waitlist_toggle(uuid) from public, anon;
grant execute on function public.closer_waitlist_toggle(uuid) to authenticated;

-- a closer who is paused cannot be hired
create or replace function public.hire_closer(p_closer uuid, p_calls integer, p_note text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me uuid := auth.uid(); nm text; hid uuid; what text;
begin
  if me is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  if p_calls is not null and p_calls not in (1, 2) then raise exception 'choose one call, two calls or every call' using errcode = '22023'; end if;
  if p_closer = me or not public.is_call_closer(p_closer) then raise exception 'that person is not a call closer' using errcode = '22023'; end if;
  if exists (select 1 from public.call_closer_details d where d.member_id = p_closer and d.paused) then raise exception 'not booking right now' using errcode = 'P0001'; end if;
  begin
    insert into public.closer_hires (member_id, closer_id, calls_total, note, status) values (me, p_closer, p_calls, nullif(left(btrim(coalesce(p_note, '')), 200), ''), 'pending') returning id into hid;
  exception when unique_violation then raise exception 'you already have a call closer hired' using errcode = '23505';
  end;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = me;
  what := case p_calls when 1 then 'one call' when 2 then 'two calls' else 'all their future calls' end;
  perform public.notify_user(p_closer, 'announcement', nm || ' wants to hire you for ' || what, 'Open Call Closers for Hire to accept or decline.', '/call-closers');
  return hid;
end $$;

-- the list now says who is paused, and whether I am waiting for them
drop function if exists public.call_closers_directory();
create function public.call_closers_directory()
returns table (id uuid, first_name text, last_name text, username citext, avatar_url text, calls_taken text, closer_since date, close_rate numeric,
               price_per_call_cents integer, price_per_sale text, review_count integer, avg_rating numeric, members_booked integer,
               cover_url text, location text, experience_text text, bio text, paused boolean, on_waitlist boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.first_name, p.last_name, p.username, p.avatar_url, d.calls_taken, d.closer_since, d.close_rate, d.price_per_call_cents, d.price_per_sale,
         (select count(*)::int from public.closer_reviews r where r.closer_id = p.id),
         (select round(avg(r.rating), 1) from public.closer_reviews r where r.closer_id = p.id),
         (select count(distinct b.member_id)::int from public.booked_calls b where b.closer_id = p.id),
         d.cover_url, d.location, d.experience_text, d.bio, coalesce(d.paused, false),
         exists (select 1 from public.closer_waitlist w where w.closer_id = p.id and w.member_id = auth.uid())
    from public.profiles p
    left join public.call_closer_details d on d.member_id = p.id
   where public.can_see('member') and p.call_closer and p.removed_at is null and p.onboarded_at is not null
   order by (select avg(r.rating) from public.closer_reviews r where r.closer_id = p.id) desc nulls last, p.first_name
$$;
revoke all on function public.call_closers_directory() from public, anon;
grant execute on function public.call_closers_directory() to authenticated;

insert into public.reserved_usernames (username) values ('call-closer'), ('callcloser') on conflict do nothing;
notify pgrst, 'reload schema';
