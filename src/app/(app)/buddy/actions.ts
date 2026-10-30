"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { currentRank, rankUp } from "@/lib/buddy/rank";
import { cleanAnswers, isComplete, rankId } from "@/lib/buddy/validate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = { ok: boolean; error?: string; rankUp?: string };

/** Saves answers as the member goes. Returns whether the questionnaire is now complete. */
export async function saveBuddyAnswers(raw: unknown): Promise<{ ok: boolean; complete: boolean; error?: string; rankUp?: string }> {
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, complete: false, error: "Only affiliates can use this." };
  const answers = cleanAnswers(raw);
  const rank = rankId(answers.rank);
  const before = await currentRank(supabase);
  const { data, error } = await supabase.rpc("ab_save", { p_answers: answers, p_rank: rank });
  if (error) return { ok: false, complete: false, error: "We could not save that. Please try again." };
  const complete = Boolean((data as { complete?: boolean } | null)?.complete) && isComplete(answers);
  if (complete) revalidatePath("/buddy");
  return { ok: true, complete, rankUp: rankUp(before, rank) ?? undefined };
}

export async function setBuddyStatus(status: "in_pool" | "paused" | "has_ab"): Promise<Result> {
  if (!["in_pool", "paused", "has_ab"].includes(status)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("ab_set_status", { p_status: status });
  if (error) return { ok: false, error: "We could not save that." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function confirmBuddyRank(rank: number): Promise<Result> {
  if (!Number.isInteger(rank) || rank < 1 || rank > 7) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const before = await currentRank(supabase);
  const { error } = await supabase.rpc("ab_confirm_rank", { p_rank: rank });
  if (error) return { ok: false, error: "We could not save that." };
  revalidatePath("/", "layout");
  return { ok: true, rankUp: rankUp(before, rank) ?? undefined };
}

export async function chooseBuddy(otherId: string): Promise<Result> {
  if (!UUID.test(otherId)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { data, error } = await supabase.rpc("ab_choose", { p_other: otherId });
  const r = data as { ok?: boolean; reason?: string } | null;
  if (error || !r?.ok) return { ok: false, error: r?.reason ?? "We could not save that." };
  revalidatePath("/", "layout");
  return { ok: true };
}


/** Start over: every answer is cleared, as if they had never filled it in. */
export async function resetBuddyAnswers(): Promise<Result> {
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("ab_reset");
  if (error) return { ok: false, error: "We could not clear your answers. Please try again." };
  revalidatePath("/buddy");
  return { ok: true };
}
