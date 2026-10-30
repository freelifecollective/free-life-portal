-- "Online" / "last seen" on profiles. The app checks in about once a minute while someone has it open.
create table public.member_presence (
  member_id    uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.member_presence enable row level security;  -- no policies: only the two functions below can touch it

create function public.touch_presence() returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.member_presence (member_id, last_seen_at) values (auth.uid(), now())
  on conflict (member_id) do update set last_seen_at = now();
end $$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- only affiliates can see when someone was last around
create function public.presence_of(p_id uuid) returns timestamptz
language sql stable security definer set search_path = public, pg_temp
as $$ select m.last_seen_at from public.member_presence m where m.member_id = p_id and public.can_see('member') $$;
revoke all on function public.presence_of(uuid) from public, anon;
grant execute on function public.presence_of(uuid) to authenticated;
