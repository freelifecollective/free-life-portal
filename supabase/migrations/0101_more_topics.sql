-- More topics to sort recordings under.
alter table public.recordings drop constraint if exists recordings_topics_check;
alter table public.recordings add constraint recordings_topics_check
  check (topics <@ array['6A+ Interviews', 'Ads', 'Belief + Mindset', 'Community calls', 'Compensation Plan', 'Event Launches + Recaps', 'In Person Sales', 'Know Your Numbers', 'Mentoring Your Downline', 'Product Knowledge', 'Social Media', 'Special Guests', 'Stacking', 'Strategy', 'Success Doesn''t Discriminate', 'Talking to Leads + Objections', 'Tracking Your Numbers', 'Verbiage + Objections']::text[]);
