-- Lacey's downline, round two: direct messages, the chat as its own section with two subtitles, and a call can be open to several audiences.

-- ---------------------------------------------------------------- calls: open to leads and/or the downline (FLC members always see every call)
alter table public.calls add column if not exists downline_open boolean not null default false;
update public.calls set downline_open = true, audience = 'affiliates_only' where audience = 'downline_open';

drop policy if exists calls_read on public.calls;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'calls' and cmd = 'SELECT' loop
    execute format('drop policy %I on public.calls', pol.policyname);
  end loop;
end $$;
create policy calls_read on public.calls for select to authenticated using (
  public.can_see('member')
  or (audience = 'leads_open' and public.can_see('lead'))
  or (downline_open and public.app_current_role() = 'downline'));

do $$
declare f record; def text; fixed text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%audience = ''downline_open''%' loop
    def := pg_get_functiondef(f.oid);
    fixed := regexp_replace(def, '([a-z]+)\.audience = ''downline_open''', '\1.downline_open', 'g');
    fixed := replace(fixed, 'audience = ''downline_open''', 'downline_open');
    execute fixed;
  end loop;
end $$;

-- who is told about a new call
create or replace function public.call_audience_users(p_call uuid) returns table (user_id uuid)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id from public.profiles p join public.calls c on c.id = p_call
  where p.onboarded_at is not null
    and (case when p.role in ('member', 'admin') then true when p.role = 'lead' then c.audience = 'leads_open' when p.role = 'downline' then c.downline_open else false end)
$$;
revoke all on function public.call_audience_users(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- direct messages: the downline can send and receive (leads and the downline do not message each other)
create or replace function public.can_message(p_recipient uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles r where r.id = p_recipient and r.onboarded_at is not null and r.id <> auth.uid()
                 and not (public.app_current_role() = 'lead' and r.role in ('lead', 'downline'))
                 and not (public.app_current_role() = 'downline' and r.role = 'lead'))
$$;

-- ---------------------------------------------------------------- the chat: its own section after Affiliates Only, with a subtitle for each side
update public.chat_sections set name = 'Lacey''s Downline', sort = 3 where name = 'Main Discussion';
update public.chats set name = 'Lacey''s Downline',
  description = 'This chat is for everyone in Lacey''s downline, including non-FLC members. Please keep in mind that, from time to time, someone outside of FLC may accidentally suggest a resource belonging to a different community that we do not have access to.',
  description_lead = 'This chat is for everyone in Lacey''s downline. There are members from many different communities here so please keep that in mind before telling people where to find things as they may not have access to your community resources.'
 where slug = 'main-discussion';
-- ---------------------------------------------------------------- Verbiage + Objections becomes an ongoing chat (people still vote on answers)
update public.chats set mode = 'conversation' where votes_on and posting = 'all';
notify pgrst, 'reload schema';
