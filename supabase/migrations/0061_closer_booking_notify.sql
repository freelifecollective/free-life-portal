-- When someone hires a call closer for a call, tell the closer.
create or replace function public.notify_closer_booking() returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare nm text;
begin
  if new.closer_id is null or new.closer_id = new.member_id then return new; end if;
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Someone') into nm from public.profiles where id = new.member_id;
  perform public.notify_user(new.closer_id, 'announcement', nm || ' hired you for a call',
    'Call with ' || new.lead_name || ' · ' || to_char(new.starts_at at time zone 'America/New_York', 'FMDay, FMMon FMDD "at" FMHH12:MI AM') || ' ET', '/');
  return new;
end $$;
drop trigger if exists booked_calls_notify_closer on public.booked_calls;
create trigger booked_calls_notify_closer after insert on public.booked_calls for each row execute function public.notify_closer_booking();
