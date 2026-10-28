-- Optional: three sample calls so the calendar has something to show. Run once in the Supabase SQL editor.
-- Times are in Eastern. Delete them later from Admin > Manage calls (or: delete from public.calls where title like '[Sample]%').
insert into public.calls (title, description, kind, audience, starts_at, duration_minutes, pinned) values
  ('[Sample] Weekly community call', E'Wins, questions and a short training. Open to leads and affiliates.', 'community', 'leads_open',
     (date_trunc('day', (now() at time zone 'America/New_York') + interval '3 days') + interval '19 hours') at time zone 'America/New_York', 60, true),
  ('[Sample] Masterclass: building your first team', 'A deeper session for affiliates only.', 'masterclass', 'affiliates_only',
     (date_trunc('day', (now() at time zone 'America/New_York') + interval '5 days') + interval '20 hours') at time zone 'America/New_York', 90, false),
  ('[Sample] Guest speaker Q&A', 'Bring a question for our guest.', 'community', 'leads_open',
     (date_trunc('day', (now() at time zone 'America/New_York') + interval '10 days') + interval '19 hours 30 minutes') at time zone 'America/New_York', 60, false);
