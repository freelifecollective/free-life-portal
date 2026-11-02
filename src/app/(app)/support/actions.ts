"use server";

import { requireMember } from "@/lib/auth/guards";
import type { SupportHit } from "@/lib/support/types";

export type FocusState = { q: string; hits: SupportHit[] | null; error: string };

/** Looks for calls, recordings, lessons, documents and recommended resources that fit what someone wants to work on. */
export async function findSupport(_prev: FocusState, form: FormData): Promise<FocusState> {
  const q = String(form.get("q") ?? "").trim().slice(0, 500);
  if (q.length < 3) return { q, hits: null, error: "Type a few words about what you would like to work on." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { q, hits: null, error: "This needs the database." };
  const { data, error } = await supabase.rpc("support_search", { p_q: q });
  if (error) return { q, hits: null, error: "We could not look that up. Please try again." };
  const hits = ((data ?? []) as SupportHit[]).map((h) => ({ ...h, rank: Number(h.rank) }));
  /* kept so the team can see what people want help with, and what we have nothing for yet */
  await supabase.from("support_questions").insert({ user_id: session.user.id, question: q, found: hits.length });
  return { q, hits, error: "" };
}
