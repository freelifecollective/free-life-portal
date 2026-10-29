-- Sort recordings by topic. A recording can be under several topics; "Community calls" recordings are open to leads.
alter table public.recordings add column topics text[] not null default '{}'
  check (topics <@ array['6A+ Interviews', 'Ads', 'Belief + Mindset', 'Community calls', 'Compensation Plan', 'Event Launches + Recaps', 'Know Your Numbers', 'Special Guests', 'Strategy', 'Success Doesn''t Discriminate', 'Talking to Leads + Objections']::text[]);
create index recordings_topics_idx on public.recordings using gin (topics);

create function public.recordings_topics_rules() returns trigger language plpgsql as $$
begin
  if 'Community calls' = any (new.topics) then new.for_leads := true; end if;
  return new;
end $$;
create trigger recordings_topics_rules before insert or update on public.recordings for each row execute function public.recordings_topics_rules();
