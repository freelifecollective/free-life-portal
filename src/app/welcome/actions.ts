"use server";

import { isCountryCode } from "@/lib/countries";
import { getSession } from "@/lib/auth/session";
import { SUPABASE_URL } from "@/lib/env";
import { cleanHandle, handleState } from "@/lib/handles";
import { PREVIEW_TAKEN, writePreviewProfile } from "@/lib/profile/preview";
import { AVATAR_KINDS, type AvatarKind } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";
import { checkUsernameFormat, usernameCandidates, type UsernameCheck } from "@/lib/username";

/** Is this username free? The format is checked here, uniqueness by the database. */
export async function checkUsernameAction(candidate: string): Promise<UsernameCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "taken" };
  const u = String(candidate ?? "").toLowerCase();
  const fmt = checkUsernameFormat(u);
  if (!fmt.ok) return fmt;
  if (session.mode === "preview") return PREVIEW_TAKEN.includes(u) ? { ok: false, reason: "taken" } : { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_username", { candidate: u });
  if (error || !data) return { ok: false, reason: "taken" };
  return data.ok ? { ok: true } : { ok: false, reason: data.reason };
}

/** A free username built from the name (firstlast, firstlast2, ...). */
export async function suggestUsernameAction(first: string, last: string): Promise<string> {
  const candidates = usernameCandidates(String(first ?? "").slice(0, 40), String(last ?? "").slice(0, 40), 12);
  for (const c of candidates) {
    if ((await checkUsernameAction(c)).ok) return c;
  }
  return candidates[0] + Math.floor(1000 + Math.random() * 9000);
}

export type SaveInput = {
  first: string; last: string; username: string; instagram: string; facebook: string; birthMonth?: string; birthDay?: string; birthYear?: string; country?: string;
  avatarKind: AvatarKind; avatarUrl: string | null;
};
export type SaveResult = { ok: true } | { ok: false; error: string; field?: "username" | "name" | "instagram" | "facebook" | "avatar" };

/** Saves the finished first-login flow and marks the profile onboarded. Everything is re-validated here. */
export async function saveProfileAction(input: SaveInput): Promise<SaveResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (session.profile.onboarded_at) return { ok: false, error: "Your profile is already set up." };

  const first = String(input.first ?? "").trim();
  const last = String(input.last ?? "").trim();
  if (!first || !last || first.length > 40 || last.length > 40) return { ok: false, error: "Enter your first and last name.", field: "name" };

  const username = String(input.username ?? "").toLowerCase();
  const fmt = checkUsernameFormat(username);
  if (!fmt.ok) return { ok: false, error: "That username is not allowed.", field: "username" };

  const igRaw = String(input.instagram ?? ""), fbRaw = String(input.facebook ?? "");
  if (handleState(igRaw, "instagram") === "bad") return { ok: false, error: "Check your Instagram handle.", field: "instagram" };
  if (handleState(fbRaw, "facebook") === "bad") return { ok: false, error: "Check your Facebook handle.", field: "facebook" };
  const instagram = igRaw.trim() ? cleanHandle(igRaw, "instagram") : null;
  const facebook = fbRaw.trim() ? cleanHandle(fbRaw, "facebook") : null;

  const bm = Number(input.birthMonth || 0), bd = Number(input.birthDay || 0), by = Number(input.birthYear || 0);
  if ((bm === 0) !== (bd === 0) || (bm && (!Number.isInteger(bm) || !Number.isInteger(bd) || bm < 1 || bm > 12 || bd < 1 || bd > new Date(2000, bm, 0).getDate()))
    || (by && (!bm || !Number.isInteger(by) || by < 1900 || by > 2100))) return { ok: false, error: "Check your birthday." };
  const birthday = bm ? { birth_month: bm, birth_day: bd, birth_year: by || null } : {};

  const country = isCountryCode(input.country) ? { country: input.country } : {};

  if (!AVATAR_KINDS.includes(input.avatarKind)) return { ok: false, error: "Choose a profile picture.", field: "avatar" };
  const done = new Date().toISOString();

  if (session.mode === "preview") {
    if (PREVIEW_TAKEN.includes(username)) return { ok: false, error: "That username is taken.", field: "username" };
    await writePreviewProfile({ first_name: first, last_name: last, username, instagram, facebook, avatar_kind: input.avatarKind, onboarded_at: done });
    return { ok: true };
  }

  // Only accept a picture that lives in this user's own folder of our avatars bucket.
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`;
  if (!input.avatarUrl || !input.avatarUrl.startsWith(prefix)) return { ok: false, error: "Your picture did not upload. Please try again.", field: "avatar" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    first_name: first, last_name: last, username, instagram, facebook, ...birthday, ...country,
    avatar_url: input.avatarUrl, avatar_kind: input.avatarKind, onboarded_at: done,
  }).eq("id", session.user.id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "That username was just taken. Please choose another.", field: "username" };
    if (error.code === "23514") return { ok: false, error: "That username is not allowed.", field: "username" };
    return { ok: false, error: "We could not save your profile. Please try again." };
  }
  return { ok: true };
}
