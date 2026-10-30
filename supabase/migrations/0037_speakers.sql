-- Speakers on calls (pictures and names), and a count of who actually attended a call live.

create table public.call_speakers (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid not null references public.calls (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  photo_url  text check (photo_url is null or photo_url ~ '^https://'),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index call_speakers_call_idx on public.call_speakers (call_id, position);
alter table public.call_speakers enable row level security;
-- anyone who can see the call can see who is speaking (the subquery obeys the calls policy)
create policy cs_read on public.call_speakers for select to authenticated using (exists (select 1 from public.calls c where c.id = call_id));
create policy cs_admin on public.call_speakers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- speaker pictures: anyone can look, only admins add or change them
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speakers', 'speakers', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists speakers_read on storage.objects;
create policy speakers_read on storage.objects for select using (bucket_id = 'speakers');
drop policy if exists speakers_admin_write on storage.objects;
create policy speakers_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'speakers' and public.is_admin());
drop policy if exists speakers_admin_update on storage.objects;
create policy speakers_admin_update on storage.objects for update to authenticated using (bucket_id = 'speakers' and public.is_admin()) with check (bucket_id = 'speakers' and public.is_admin());
drop policy if exists speakers_admin_delete on storage.objects;
create policy speakers_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'speakers' and public.is_admin());

-- the landing pages show the speakers too
create or replace function public.next_public_call() returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'starts_at', c.starts_at,
    'duration_minutes', c.duration_minutes, 'registered', coalesce(s.registered, 0),
    'speakers', coalesce((select jsonb_agg(jsonb_build_object('name', sp.name, 'photo_url', sp.photo_url) order by sp.position, sp.created_at) from public.call_speakers sp where sp.call_id = c.id), '[]'::jsonb))
  from public.calls c left join public.call_stats s on s.call_id = c.id
  where c.audience = 'leads_open' and c.starts_at + make_interval(mins => c.duration_minutes) > now()
  order by c.pinned desc, c.starts_at limit 1
$$;

-- Who joined a call live (pressed Join in the portal): how many, and the first few people with their pictures.
create or replace function public.call_attendance_summary(p_call uuid, p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare visible boolean; n integer; people jsonb;
begin
  select exists (select 1 from public.calls c where c.id = p_call
    and (public.can_see('member') or (c.audience = 'leads_open' and public.can_see('lead')))) into visible;
  if not visible then return null; end if;
  select count(*)::integer into n from public.call_attendance where call_id = p_call;
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(pr.first_name, ''), 'username', pr.username, 'avatar_url', pr.avatar_url, 'mode', 'live') order by a.joined_at), '[]'::jsonb)
    into people
    from (select * from public.call_attendance where call_id = p_call order by joined_at limit greatest(least(coalesce(p_limit, 50), 100), 0)) a
    join public.profiles pr on pr.id = a.user_id where pr.onboarded_at is not null;
  return jsonb_build_object('count', n, 'people', people);
end $$;
revoke all on function public.call_attendance_summary(uuid, integer) from public, anon;
grant execute on function public.call_attendance_summary(uuid, integer) to authenticated;
