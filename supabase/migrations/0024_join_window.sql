-- The waiting room opens 10 minutes before a call. Before that, the join link is not handed out.
create or replace function public.join_call(p_call uuid) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c public.calls;
begin
  if auth.uid() is null then return null; end if;
  select * into c from public.calls k where k.id = p_call
    and (public.can_see('member') or (k.audience = 'leads_open' and public.can_see('lead')));
  if not found then return null; end if;
  if now() < c.starts_at - interval '10 minutes' then return null; end if;
  if now() <= c.starts_at + make_interval(mins => c.duration_minutes) + interval '60 minutes' then
    insert into public.call_attendance (call_id, user_id) values (c.id, auth.uid()) on conflict do nothing;
  end if;
  return c.join_url;
end $$;
