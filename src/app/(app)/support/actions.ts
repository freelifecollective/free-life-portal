"use server";

import { requireMember } from "@/lib/auth/guards";
import type { SupportHit, SupportPeople, SupportPerson } from "@/lib/support/types";

export type FocusState = { q: string; hits: SupportHit[] | null; error: string; /** a hard moment: ask about the buddy and coach first */ checkin: boolean; people: SupportPeople };

/** Looks for calls, recordings, lessons, documents and recommended resources that fit what someone wants to work on. */
export async function findSupport(_prev: FocusState, form: FormData): Promise<FocusState> {
  const q = String(form.get("q") ?? "").trim().slice(0, 500);
  if (q.length < 3) return { q, hits: null, error: "Type a few words about what you would like to work on.", checkin: false, people: { coach: null, buddy: null } };
  const { supabase } = await requireMember();
  if (!supabase) return { q, hits: null, error: "This needs the database.", checkin: false, people: { coach: null, buddy: null } };
  const { data, error } = await supabase.rpc("support_search", { p_q: q });
  if (error) return { q, hits: null, error: "We could not look that up. Please try again.", checkin: false, people: { coach: null, buddy: null } };
  const hits = ((data ?? []) as SupportHit[]).map((h) => ({ ...h, rank: Number(h.rank), reviews: Number(h.reviews ?? 0) }));
  const [{ data: intent }, { data: ppl }] = await Promise.all([supabase.rpc("support_intent", { p_q: q }), supabase.rpc("my_support_people")]);
  const checkin = ((intent ?? []) as { checkin: boolean }[]).some((i) => i.checkin);
  const rows = (ppl ?? []) as (SupportPerson & { role: string })[];
  const people: SupportPeople = { coach: rows.find((r) => r.role === "coach") ?? null, buddy: rows.find((r) => r.role === "buddy") ?? null };
  /* kept anonymously (only the theme and main words, never the person or the question) so recurring needs can be seen */
  await supabase.rpc("log_support_ask", { p_q: q, p_found: hits.length });
  return { q, hits, error: "", checkin, people };
}
