-- Outsourcing: choose from a fixed list of offerings, and no headline.
alter table public.outsourcing_profiles alter column headline drop not null;
update public.outsourcing_profiles set tasks = array(select t from unnest(tasks) t where t = any (array['Ads Creation', 'Ads Manager', 'Canva Presentations', 'Coaching Calls', 'Content Creation', 'Creating Forms', 'Emails + Campaigns', 'General Organization', 'Google Suite', 'Lead Follow-Up', 'Lead Organization', 'Zoom support']));
delete from public.outsourcing_profiles where cardinality(tasks) = 0;
alter table public.outsourcing_profiles add constraint outsourcing_tasks_allowed
  check (tasks <@ array['Ads Creation', 'Ads Manager', 'Canva Presentations', 'Coaching Calls', 'Content Creation', 'Creating Forms', 'Emails + Campaigns', 'General Organization', 'Google Suite', 'Lead Follow-Up', 'Lead Organization', 'Zoom support']::text[]);
