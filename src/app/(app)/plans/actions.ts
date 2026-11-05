"use server";

import { requireMember } from "@/lib/auth/guards";
import { isPlanTier } from "@/lib/plans";

/** Remembers that someone wants a plan, until checkout is connected. */
export async function choosePlan(tier: number): Promise<{ ok: boolean }> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isPlanTier(tier)) return { ok: false };
  const { error } = await supabase.from("plan_interest").insert({ user_id: session.user.id, tier });
  return { ok: !error };
}
