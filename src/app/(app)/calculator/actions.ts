"use server";

import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";
import { cleanQuote } from "@/lib/quote/model";

/** Saves a quote and gives back its share address. The base prices are never taken from the browser: only which products, the tax and the shipping. */
export async function createQuote(raw: unknown): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return { ok: false, error: "Quotes are for affiliates." };
  const data = cleanQuote(raw);
  if (!data) return { ok: false, error: "Choose at least one product." };
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase.from("quotes").select("token", { count: "exact", head: true }).eq("user_id", session.user.id).gte("created_at", since);
  if ((count ?? 0) >= 60) return { ok: false, error: "That is a lot of quotes in an hour. Please wait a little." };
  const { data: row, error } = await supabase.from("quotes").insert({ user_id: session.user.id, data }).select("token").single();
  if (error || !row) return { ok: false, error: "We could not save that. Please try again." };
  return { ok: true, token: (row as { token: string }).token };
}
