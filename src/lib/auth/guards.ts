import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AppSession } from "@/lib/profile/types";

export type SignedIn = { session: AppSession; supabase: SupabaseClient };

/** A signed-in member with a finished profile. Preview mode has no database, so pages that need one get `supabase: null`. */
export async function requireMember(): Promise<{ session: AppSession; supabase: SupabaseClient | null }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at) redirect("/welcome");
  return { session, supabase: session.mode === "supabase" ? await createClient() : null };
}

/** An admin. Anyone else is sent home. The database enforces the same rule, this just keeps the pages tidy. */
export async function requireAdmin(): Promise<SignedIn> {
  const { session, supabase } = await requireMember();
  if (session.profile.role !== "admin" || !supabase) redirect("/");
  return { session, supabase };
}
