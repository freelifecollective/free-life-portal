"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { SUPABASE_URL } from "@/lib/env";
import { cleanHandle, handleState } from "@/lib/handles";
import { createClient } from "@/lib/supabase/server";
import { submitRegistration, type RegisterState } from "@/lib/registration";

/** A lead registers on a member's page. The member who invited them is remembered. */
export async function registerFromLanding(username: string, callId: string, _prev: RegisterState, form: FormData): Promise<RegisterState> {
  return submitRegistration({ callId, form, referrer: username });
}

/** A page was opened or its button tapped. Quiet on purpose: a failure here must never get in a visitor's way. */
export async function trackLanding(username: string, kind: "visit" | "click", visitor: string): Promise<void> {
  try {
    if ((kind !== "visit" && kind !== "click") || !/^[A-Za-z0-9_-]{8,64}$/.test(visitor) || username.length > 40) return;
    await (await createClient()).rpc("track_landing", { p_username: username, p_kind: kind, p_visitor: visitor });
  } catch { /* tracking is optional */ }
}

export type SaveResult = { ok: boolean; error?: string };

/** Use this picture on my landing page (null goes back to my profile picture). Only pictures in my own folder are accepted. */
export async function saveLandingPhoto(url: string | null): Promise<SaveResult> {
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  if (url !== null) {
    const prefix = `${SUPABASE_URL}/storage/v1/object/public/landing/${session.user.id}/`;
    if (!url.startsWith(prefix) || url.length > 300) return { ok: false, error: "That picture did not upload. Please try again." };
  }
  const { error } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, photo_url: url }, { onConflict: "member_id" });
  if (error) return { ok: false, error: "We could not save your picture. Please try again." };
  revalidatePath("/" + (session.profile.username ?? ""));
  return { ok: true };
}

/** Update my social links on my landing page, and optionally on my portal profile too. */
export async function saveLandingLinks(input: { instagram: string; facebook: string; alsoProfile: boolean }): Promise<SaveResult> {
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  if (handleState(input.instagram, "instagram") === "bad") return { ok: false, error: "Check your Instagram handle." };
  if (handleState(input.facebook, "facebook") === "bad") return { ok: false, error: "Check your Facebook handle." };
  const ig = input.instagram.trim() ? cleanHandle(input.instagram, "instagram") : "";
  const fb = input.facebook.trim() ? cleanHandle(input.facebook, "facebook") : "";

  if (input.alsoProfile) {
    // the profile gets the new links; the page then simply follows the profile
    const { error } = await supabase.from("profiles").update({ instagram: ig || null, facebook: fb || null }).eq("id", session.user.id);
    if (error) return { ok: false, error: "We could not update your profile. Please try again." };
    const { error: e2 } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, instagram: null, facebook: null }, { onConflict: "member_id" });
    if (e2) return { ok: false, error: "We could not update your page. Please try again." };
  } else {
    const { error } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, instagram: ig, facebook: fb }, { onConflict: "member_id" });
    if (error) return { ok: false, error: "We could not update your page. Please try again." };
  }
  revalidatePath("/" + (session.profile.username ?? ""));
  revalidatePath("/");
  return { ok: true };
}
