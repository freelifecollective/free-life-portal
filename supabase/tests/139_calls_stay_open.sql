-- Phase 238: a call stays open until the host ends it.
begin;
create schema tests;
create function tests.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', r, true);
  execute format('set local role %I', r);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', true); execute 'reset role'; end $$;
create function tests.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;
create function tests.fails(label text, stmt text, want_state text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then
    if sqlstate = want_state then raise notice 'ok   % (%)', label, sqlstate; return; end if;
    raise exception 'FAIL % : expected %, got % (%)', label, want_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL % : statement succeeded but should have failed', label;
end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; b uuid;
begin
  -- a 30 minute call that began three hours ago: it used to be shut by now
  insert into public.booked_calls (member_id, lead_name, starts_at, lead_id) values (mia, 'Lena', now() - interval '3 hours', lena) returning id into b;
  perform tests.login(lena);
  perform tests.eq('a call that has run long is still open', (select open_now from public.room_info(b)), true);
  perform tests.eq('the lead cannot end it', (select count(*) from public.room_ended(b) x where x), 0::bigint);
  perform tests.fails('the lead cannot end it for everyone', format('select public.end_room(%L)', b), '42501');
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('the host sees it open too', (select open_now from public.room_info(b)), true);
  perform public.end_room(b);
  perform tests.eq('after the host ends it, the room is closed', (select open_now from public.room_info(b)), false);
  perform tests.eq('and marked ended', (select ended from public.room_info(b)), true);
  perform tests.logout();
  perform tests.login(lena);
  perform tests.eq('the lead learns it ended', public.room_ended(b), true);
  perform tests.logout();
end $$;
do $$ begin
  if (select prosrc from pg_proc where proname = 'room_beat') !~ '12 hours' then raise exception 'FAIL room_beat still uses the old window'; end if;
  raise notice 'ok   room_beat counts while a call runs over';
end $$;
rollback;
