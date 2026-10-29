"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { SUPABASE_URL } from "@/lib/env";
import { cleanHandle, handleState } from "@/lib/handles";
import { AVATAR_KINDS, type AvatarKind } from "@/lib/profile/types";
import { isQuoteStyle } from "@/lib/quotes";
import { checkUsernameFormat } from "@/lib/username";

export type SettingsState = { error: string; saved?: boolean };

export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const first = String(form.get("first") ?? "").trim();
  const last = String(form.get("last") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const igRaw = String(form.get("instagram") ?? ""), fbRaw = String(form.get("facebook") ?? "");
  const rankRaw = String(form.get("rank") ?? "");
  if (!first || !last || first.length > 40 || last.length > 40) return { error: "Enter your first and last name." };
  const fmt = checkUsernameFormat(username);
  if (!fmt.ok) return { error: "That username is not allowed. Use 3 to 30 letters, numbers, dashes or underscores." };
  if (handleState(igRaw, "instagram") === "bad") return { error: "Check your Instagram handle." };
  if (handleState(fbRaw, "facebook") === "bad") return { error: "Check your Facebook handle." };

  const { session, supabase } = await requireMember();
  if (!supabase) return { error: "Settings need the database, which preview mode does not have." };
  const isMember = session.profile.role !== "lead";
  const patch: Record<string, unknown> = { first_name: first, last_name: last, username };
  if (isMember) {
    patch.instagram = igRaw.trim() ? cleanHandle(igRaw, "instagram") : null;
    patch.facebook = fbRaw.trim() ? cleanHandle(fbRaw, "facebook") : null;
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", session.user.id);
  if (error) {
    if (error.code === "23505") return { error: "That username is already taken. Please choose another." };
    if (error.code === "23514") return { error: "That username is not allowed." };
    return { error: "We could not save that. Please try again." };
  }
  if (isMember) {
    const rank = rankRaw ? Number(rankRaw) : null;
    if (rank !== null && !(Number.isInteger(rank) && rank >= 1 && rank <= 7)) return { error: "Choose a rank from the list." };
    const { error: rErr } = await supabase.from("member_private").upsert({ member_id: session.user.id, rank_id: rank, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
    if (rErr) return { error: "Your details saved, but your rank did not. Please try again." };
  }
  revalidatePath("/", "layout");
  return { error: "", saved: true };
}

/** Saves a new profile picture that the browser has already uploaded to this person's own folder. */
export async function saveAvatar(kind: AvatarKind, url: string): Promise<{ ok: boolean; error?: string }> {
  const { session, supabase } = await requireMember();
  if (!supabase || !AVATAR_KINDS.includes(kind)) return { ok: false, error: "Something went wrong." };
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`;
  if (!url.startsWith(prefix)) return { ok: false, error: "Your picture did not upload. Please try again." };
  const { error } = await supabase.from("profiles").update({ avatar_url: url, avatar_kind: kind }).eq("id", session.user.id);
  if (error) return { ok: false, error: "We could not save your picture. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Which kind of daily quote the person sees on Home. */
export async function saveQuoteStyle(style: string): Promise<{ ok: boolean; error?: string }> {
  if (!isQuoteStyle(style)) return { ok: false, error: "Choose one of the options." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("member_prefs").upsert({ member_id: session.user.id, quote_style: style }, { onConflict: "member_id" });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/");
  return { ok: true };
}
