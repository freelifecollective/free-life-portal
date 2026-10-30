-- Call closer details: "calls taken" can include symbols (like 50+), and "charge per product sale" can run over several lines.
alter table public.call_closer_details drop constraint if exists call_closer_details_calls_taken_check;
alter table public.call_closer_details alter column calls_taken drop default;
alter table public.call_closer_details alter column calls_taken drop not null;
alter table public.call_closer_details alter column calls_taken type text using calls_taken::text;
alter table public.call_closer_details drop constraint if exists call_closer_details_calls_taken_len;
alter table public.call_closer_details add constraint call_closer_details_calls_taken_len check (calls_taken is null or char_length(calls_taken) <= 40);

alter table public.call_closer_details drop constraint if exists call_closer_details_price_per_sale_check;
alter table public.call_closer_details drop constraint if exists call_closer_details_price_per_sale_len;
alter table public.call_closer_details add constraint call_closer_details_price_per_sale_len check (price_per_sale is null or char_length(price_per_sale) <= 400);
