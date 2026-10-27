import "server-only";
import { cookies } from "next/headers";
import type { AvatarKind, Profile } from "./types";

/** Preview mode only: the profile lives in a cookie so the flow works without a database. */
export const PREVIEW_COOKIE = "flc_preview";
export const PREVIEW_USER_ID = "00000000-0000-0000-0000-000000000000";

/** Names pretend to be taken so the "taken" message can be seen. Real uniqueness is the database's job. */
export const PREVIEW_TAKEN = ["sarahchen", "alexrivera", "jordanlee", "mayapatel", "samwilson", "taylorkim", "chrisadams", "morganblake"];

type Stored = {
  first_name: string; last_name: string; username: string; instagram: string | null; facebook: string | null;
  avatar_kind: AvatarKind | null; onboarded_at: string;
};

export async function readPreviewProfile(): Promise<Profile> {
  const raw = (await cookies()).get(PREVIEW_COOKIE)?.value;
  let s: Partial<Stored> = {};
  try { if (raw) s = JSON.parse(raw); } catch { /* treat as empty */ }
  return {
    id: PREVIEW_USER_ID,
    first_name: s.first_name ?? null,
    last_name: s.last_name ?? null,
    username: s.username ?? null,
    instagram: s.instagram ?? null,
    facebook: s.facebook ?? null,
    avatar_url: null, // the picture stays in the browser in preview mode
    avatar_kind: s.avatar_kind ?? null,
    role: "lead",
    onboarded_at: s.onboarded_at ?? null,
  };
}

export async function writePreviewProfile(s: Stored) {
  (await cookies()).set(PREVIEW_COOKIE, JSON.stringify(s), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearPreviewProfile() {
  (await cookies()).delete(PREVIEW_COOKIE);
}
