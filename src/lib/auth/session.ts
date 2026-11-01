import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { previewMode, supabaseConfigured } from "@/lib/env";
import { readPreviewProfile, PREVIEW_USER_ID } from "@/lib/profile/preview";
import type { AppSession, Profile } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

const PROFILE_COLUMNS =
  "id, first_name, last_name, username, instagram, facebook, avatar_url, avatar_kind, role, onboarded_at, call_closer";

/**
 * The signed-in user and their profile, verified with the auth server (never trust cookies alone).
 * Returns null when nobody is signed in. Cached for the length of one request.
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  if (!supabaseConfigured) {
    if (!previewMode) return null;
    return { mode: "preview", user: { id: PREVIEW_USER_ID, email: "preview@example.com" }, profile: await readPreviewProfile() };
  }
  await connection(); // the session check must wait for a real request, never run while prerendering
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", auth.user.id).single<Profile>();
  if (!profile) return null;
  return { mode: "supabase", user: { id: auth.user.id, email: auth.user.email ?? null }, profile };
});
