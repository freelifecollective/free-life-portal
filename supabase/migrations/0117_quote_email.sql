-- Emailing a quote to a lead: the email waits in the outbox and goes out like the other portal emails.
create or replace function public.queue_quote_email(p_token text, p_to text, p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me public.profiles; n integer; t text := lower(btrim(p_to));
begin
  if auth.uid() is null or not public.can_see('member') then raise exception 'affiliates only' using errcode = '42501'; end if;
  select * into me from public.profiles where id = auth.uid();
  if not exists (select 1 from public.quotes q where q.token = p_token and q.user_id = auth.uid()) then raise exception 'not your quote' using errcode = '42501'; end if;
  if t !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or char_length(t) > 254 then raise exception 'bad email' using errcode = '22023'; end if;
  select count(*) into n from public.email_outbox o where o.template = 'quote_share' and o.payload->>'from_id' = auth.uid()::text and o.created_at > now() - interval '1 day';
  if n >= 30 then raise exception 'too many emails today' using errcode = '54000'; end if;
  insert into public.email_outbox (to_email, template, payload)
  values (t, 'quote_share', jsonb_build_object('name', left(btrim(coalesce(p_name, '')), 60), 'token', p_token, 'from_id', auth.uid(),
          'from_name', btrim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')), 'reply_to', me.email));
end $$;
revoke all on function public.queue_quote_email(text, text, text) from public, anon;
grant execute on function public.queue_quote_email(text, text, text) to authenticated;
