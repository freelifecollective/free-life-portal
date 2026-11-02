-- Lacey's Downline: a third kind of account beside leads and affiliates. (Adding the new values has to be its own step; 0096 uses them.)
alter type public.app_role add value if not exists 'downline';
alter type public.call_audience add value if not exists 'downline_open';
