-- How long a call runs is now chosen from a list. The label is what people see; duration_minutes stays the longest it can run. (safe to run more than once)
alter table public.calls add column if not exists length_label text check (length_label in ('1 hour', '1-1.5 hours', '1-2 hours', '1.5-2 hours', '2+ hours'));

create or replace function public.public_call(p_call uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'starts_at', c.starts_at, 'duration_minutes', c.duration_minutes, 'length_label', c.length_label)
  from public.calls c
  where c.id = p_call and c.audience = 'leads_open' and c.starts_at + make_interval(mins => c.duration_minutes) > now()
$$;

create or replace function public.next_public_call() returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'starts_at', c.starts_at,
    'duration_minutes', c.duration_minutes, 'length_label', c.length_label, 'registered', coalesce(s.registered, 0),
    'speakers', coalesce((select jsonb_agg(jsonb_build_object('name', sp.name, 'photo_url', sp.photo_url) order by sp.position, sp.created_at) from public.call_speakers sp where sp.call_id = c.id), '[]'::jsonb))
  from public.calls c left join public.call_stats s on s.call_id = c.id
  where c.audience = 'leads_open' and c.starts_at + make_interval(mins => c.duration_minutes) > now()
  order by c.pinned desc, c.starts_at limit 1
$$;
