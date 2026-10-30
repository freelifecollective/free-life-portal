-- The "who is leading the call" box is gone: speakers replace it. Any name typed there before becomes a speaker (without a picture). (safe to run more than once)
insert into public.call_speakers (call_id, name, position)
select c.id, left(btrim(c.host), 80), 0 from public.calls c
 where c.host is not null and btrim(c.host) <> '' and not exists (select 1 from public.call_speakers s where s.call_id = c.id);
update public.calls set host = null where host is not null;
