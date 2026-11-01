-- Phase 106: voice notes can be up to one hour long (they were limited to ten minutes).
do $$ declare t text; begin
  foreach t in array array['chat_posts', 'group_messages', 'direct_messages'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_audio_check');
    execute format($f$alter table public.%I add constraint %I check (audio_url is null or (char_length(audio_url) <= 1000 and audio_url ~ '^https://[a-z0-9.-]+/storage/v1/object/public/voice-notes/' and audio_secs between 1 and 3600))$f$, t, t || '_audio_check');
  end loop;
end $$;
update storage.buckets set file_size_limit = 52428800 where id = 'voice-notes';
notify pgrst, 'reload schema';
