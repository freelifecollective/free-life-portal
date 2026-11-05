-- Phase 204: lead board tags and follow-up automation.
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

insert into public.signup_allowlist (email, role) values ('mia@example.com','member'),('lena@example.com','lead');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','mia@example.com'),('00000000-0000-0000-0000-0000000000a3','lena@example.com');
update public.profiles set first_name='Mia', last_name='M', username='miamember', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name='Lena', last_name='L', username='lenalead', onboarded_at=now() where id='00000000-0000-0000-0000-0000000000a3';

do $$ declare mia uuid := '00000000-0000-0000-0000-0000000000a1'; lena uuid := '00000000-0000-0000-0000-0000000000a3'; l_new uuid; card uuid; c2 uuid; ln text;
begin
  perform tests.login(mia);
  perform public.ensure_lead_boards();
  perform public.ensure_lead_tags();
  perform public.ensure_lead_tags();
  perform tests.eq('eight starter tags, made once', (select count(*) from public.lead_tags), 8::bigint);
  select id into l_new from public.lead_lists where name = 'New Lead';
  perform tests.logout();
  -- an Instagram handle puts the Instagram tag on by itself
  insert into public.lead_cards (list_id, user_id, name, email, instagram) values (l_new, mia, 'Lena Lead', 'lena@example.com', '@lena') returning id into card;
  perform tests.eq('Instagram Lead tag on automatically', (select count(*) from public.lead_card_tags ct join public.lead_tags t on t.id = ct.tag_id where ct.card_id = card and t.system_key = 'instagram'), 1::bigint);
  -- the affiliate messages the lead
  insert into public.direct_messages (sender_id, recipient_id, body) values (mia, lena, 'Hi Lena!');
  select x.name into ln from public.lead_cards c join public.lead_lists x on x.id = c.list_id where c.id = card;
  perform tests.eq('sending a message moves the lead to Follow Up Set', ln, 'Follow Up Set');
  perform tests.eq('and sets the next follow-up three days out', (select follow_up_on from public.lead_cards where id = card), current_date + 3);
  -- three days later (the date has come)
  update public.lead_cards set follow_up_on = current_date - 1 where id = card;
  perform tests.eq('the hourly check moves it', public.queue_lead_followups(), 1);
  select x.name into ln from public.lead_cards c join public.lead_lists x on x.id = c.list_id where c.id = card;
  perform tests.eq('to Follow Up Due', ln, 'Follow Up Due');
  perform tests.eq('and nudges the affiliate', (select count(*) from public.notifications where user_id = mia and kind = 'lead_followup'), 1::bigint);
  -- a card moved by hand to Circle Back in 60 Days starts a countdown
  update public.lead_cards set list_id = (select id from public.lead_lists where name = 'Circle Back in 60 Days') where id = card;
  perform tests.eq('60 day countdown', (select resume_on from public.lead_cards where id = card), current_date + 60);
  update public.lead_cards set resume_on = current_date - 1 where id = card;
  perform public.queue_lead_followups();
  select x.name into ln from public.lead_cards c join public.lead_lists x on x.id = c.list_id where c.id = card;
  perform tests.eq('after the countdown it comes back as Follow Up Due', ln, 'Follow Up Due');
  update public.lead_cards set list_id = (select id from public.lead_lists where name = 'Ghosted (Circle Back in 90 Days)') where id = card;
  perform tests.eq('90 day countdown', (select resume_on from public.lead_cards where id = card), current_date + 90);
  perform tests.eq('Ghosted tag on automatically', (select count(*) from public.lead_card_tags ct join public.lead_tags t on t.id = ct.tag_id where ct.card_id = card and t.system_key = 'ghosted'), 1::bigint);
  -- the lead says no
  update public.lead_cards set list_id = l_new where id = card;
  insert into public.direct_messages (sender_id, recipient_id, body) values (lena, mia, 'Thanks but no, I''m not interested');
  select x.name into ln from public.lead_cards c join public.lead_lists x on x.id = c.list_id where c.id = card;
  perform tests.eq('not interested moves the card to Said No', ln, 'Said No/Not Interested');
  perform tests.eq('and tags it', (select count(*) from public.lead_card_tags ct join public.lead_tags t on t.id = ct.tag_id where ct.card_id = card and t.system_key = 'said_no'), 1::bigint);
  -- Registered for the Portal adds the In FLC Portal tag
  insert into public.lead_cards (list_id, user_id, name, email) values (l_new, mia, 'Second', 'second@example.com') returning id into c2;
  perform tests.login(mia);
  perform public.lead_register_in_portal(c2);
  perform tests.logout();
  perform tests.login(mia);
  perform tests.eq('a card for someone in the portal offers Send Message', (select username from public.lead_card_portal_users() where card_id = card), 'lenalead');
  perform tests.logout();
  perform tests.eq('In FLC Portal tag on automatically', (select count(*) from public.lead_card_tags ct join public.lead_tags t on t.id = ct.tag_id where ct.card_id = c2 and t.system_key = 'in_portal'), 1::bigint);
end $$;
rollback;
