-- Pictures, GIFs and removing sent messages.
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
create function tests.rows(stmt text) returns bigint language plpgsql as $$
declare n bigint; begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('ada@example.com','member'),('max@example.com','member'),('lena@example.com','lead'),('liz@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a4','ada@example.com'),('00000000-0000-0000-0000-0000000000a5','max@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com'),('00000000-0000-0000-0000-0000000000a6','liz@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Ada', last_name='A', username='adaadmin', role='admin', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a4';
update public.profiles set first_name='Max', last_name='X', username='maxmember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a5';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name='Liz', last_name='Z', username='lizlead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a6';

do $$ declare mid uuid; begin
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  insert into public.direct_messages (sender_id, recipient_id, body, image_url) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a5','','https://media2.giphy.com/media/abc/200.gif') returning id into mid;
  perform tests.eq('a GIF with no words can be sent', (select count(*) from public.direct_messages where id = mid), 1::bigint);
  perform tests.fails('a picture from an unknown site is refused', $q$insert into public.direct_messages (sender_id, recipient_id, body, image_url) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a5','hi','https://evil.example.com/x.png')$q$, '23514');
  perform tests.fails('an empty message with no picture is refused', $q$insert into public.direct_messages (sender_id, recipient_id, body) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a5','  ')$q$, '23514');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a5');
  perform tests.eq('the receiver cannot remove it', tests.rows(format('delete from public.direct_messages where id = %L', mid)), 0::bigint);
  perform tests.fails('the picture cannot be swapped', format($q$update public.direct_messages set image_url = 'https://media1.giphy.com/media/z/1.gif' where id = %L$q$, mid), '42501');
  perform tests.logout();
  perform tests.login('00000000-0000-0000-0000-0000000000a1');
  perform tests.eq('the sender can remove it', tests.rows(format('delete from public.direct_messages where id = %L', mid)), 1::bigint);
  perform tests.logout();
end $$;
rollback;
