"use server";

import { revalidatePath } from "next/cache";
import { requireMember, requirePlan } from "@/lib/auth/guards";
import { COPY_FIELDS, type LandingCopy } from "@/components/landing/content";
import { SUPABASE_URL } from "@/lib/env";
import { toEmbedUrl } from "@/lib/landing/video";

export type SaveResult = { ok: boolean; error?: string };

function refresh(username: string | null) {
  revalidatePath("/advertising/landing-page");
  if (username) revalidatePath("/" + username);
}

/** Builder and Leader: my own words on my landing page. Empty boxes go back to the standard words. */
export async function saveLandingWords(input: Record<string, string>): Promise<SaveResult> {
  const { session, supabase } = await requirePlan(97);
  const copy: LandingCopy = {};
  for (const f of COPY_FIELDS) {
    const v = typeof input[f.key] === "string" ? input[f.key].trim() : "";
    if (v.length > f.max) return { ok: false, error: `"${f.label}" is too long (${f.max} characters at most).` };
    if (v && v !== f.standard) copy[f.key] = v;
  }
  const { error } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, copy: Object.keys(copy).length ? copy : null }, { onConflict: "member_id" });
  if (error) return { ok: false, error: "We could not save your words. Please try again." };
  refresh(session.profile.username);
  return { ok: true };
}

/** Builder and Leader: my own video, from a Vimeo or YouTube link. An empty link goes back to the standard video. */
export async function saveLandingVideo(link: string): Promise<SaveResult> {
  const { session, supabase } = await requirePlan(97);
  const trimmed = link.trim();
  const url = trimmed ? toEmbedUrl(trimmed) : null;
  if (trimmed && !url) return { ok: false, error: "Paste a link to a video on Vimeo or YouTube." };
  const { error } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, video_url: url }, { onConflict: "member_id" });
  if (error) return { ok: false, error: "We could not save your video. Please try again." };
  refresh(session.profile.username);
  return { ok: true };
}

/** Builder and Leader: my own picture on the video (null goes back to the standard picture). Only pictures in my own folder. */
export async function saveLandingPoster(url: string | null): Promise<SaveResult> {
  const { session, supabase } = await requirePlan(97);
  if (url !== null) {
    const prefix = `${SUPABASE_URL}/storage/v1/object/public/landing/${session.user.id}/`;
    if (!url.startsWith(prefix) || url.length > 300) return { ok: false, error: "That picture did not upload. Please try again." };
  }
  const { error } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, poster_url: url }, { onConflict: "member_id" });
  if (error) return { ok: false, error: "We could not save your picture. Please try again." };
  refresh(session.profile.username);
  return { ok: true };
}

/** $33 and $47: play the video that comes with my account, or my coach's video. */
export async function saveVideoChoice(choice: "standard" | "coach"): Promise<SaveResult> {
  const { session, supabase } = await requireMember();
  if (!supabase || (choice !== "standard" && choice !== "coach")) return { ok: false, error: "Something went wrong." };
  const { error } = await supabase.from("landing_pages").upsert({ member_id: session.user.id, video_choice: choice }, { onConflict: "member_id" });
  if (error) return { ok: false, error: "We could not save your choice. Please try again." };
  refresh(session.profile.username);
  return { ok: true };
}
