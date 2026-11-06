-- Phase 227: a lead's coach, found from the invite, a lead board or who added them.
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead'),('lou@example.com','lead'),('liv@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a7','lou@example.com'),('00000000-0000-0000-0000-0000000000a8','liv@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Lou', last_name='L', username='loulead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a7';
update public.profiles set first_name='Liv', last_name='L', username='livlead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a8';
-- Lena is on Mia's lead board (no invite on record); Lou was added to the allowlist by Mia; Liv has no coach
insert into public.lead_boards (id, user_id, name) values ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000a1', 'Leads');
insert into public.lead_lists (id, board_id, user_id, name) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000a1', 'New');
insert into public.lead_cards (list_id, user_id, name, email) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1', 'Lena', 'lena@example.com');
update public.signup_allowlist set created_by = '00000000-0000-0000-0000-0000000000a1' where email = 'lou@example.com';
do $$ begin
  perform tests.login('00000000-0000-0000-0000-0000000000a3');
  perform tests.eq('a lead on a board has that affiliate as coach', public.my_coach(), '00000000-0000-0000-0000-0000000000a1'::uuid);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a7');
  perform tests.eq('a lead the affiliate added has them as coach', public.my_coach(), '00000000-0000-0000-0000-0000000000a1'::uuid);
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a8');
  perform tests.eq('a lead with nobody has no coach', public.my_coach() is null, true);
  perform tests.logout();
end $$;
rollback;
