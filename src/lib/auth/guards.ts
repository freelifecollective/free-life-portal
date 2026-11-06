import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/session";
import { createClient, previewMemberId } from "@/lib/supabase/server";
import type { AppSession } from "@/lib/profile/types";
import { previewStore } from "@/lib/locked/preview";
import { previewLandingUsername } from "@/lib/locked/account";

export type SignedIn = { session: AppSession; supabase: SupabaseClient };

/** A signed-in member with a finished profile. Preview mode has no database, so pages that need one get `supabase: null`. */
export async function requireMember(): Promise<{ session: AppSession; supabase: SupabaseClient | null }> {
  const real = await getSession();
  if (!real) redirect("/login");
  if (real.profile.removed_at) redirect("/removed");
  if (!real.profile.onboarded_at) redirect("/welcome");
  /* a locked page being drawn for the downline: the page believes a member opened it (the database does not) */
  const previewing = !!previewStore.getStore() && real.profile.role === "downline";
  const pid = previewing ? await previewMemberId() : null;
  const session = previewing ? { ...real, user: pid ? { ...real.user, id: pid } : real.user, profile: { ...real.profile, id: pid ?? real.profile.id, role: "member" as const, username: (await previewLandingUsername()) ?? real.profile.username } } : real;
  return { session, supabase: session.mode === "supabase" ? await createClient() : null };
}

/** An admin. Anyone else is sent home. The database enforces the same rule, this just keeps the pages tidy. */
export async function requireAdmin(): Promise<SignedIn> {
  const { session, supabase } = await requireMember();
  if (session.profile.role !== "admin" || !supabase) redirect("/");
  return { session, supabase };
}
