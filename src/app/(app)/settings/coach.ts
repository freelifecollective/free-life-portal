"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Choose who your coach is (so "message my coach" opens the right conversation). */
export async function setMyCoach(coach: string, outsideName = ""): Promise<{ ok: boolean; error?: string }> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return { ok: false, error: "This is for affiliates." };
  const outside = outsideName.trim().slice(0, 80);
  if (outsideName && !outside) return { ok: false, error: "Type your coach's name." };
  const c = coach && UUID.test(coach) ? coach : null;
  if (coach && !c) return { ok: false, error: "Choose someone from the list." };
  const { error } = await supabase.rpc("set_my_coach", { p_coach: outside ? null : c, p_outside: outside || null });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}
