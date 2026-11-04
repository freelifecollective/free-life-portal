"use server";

import { requireMember } from "@/lib/auth/guards";
import { drainOutbox } from "@/lib/email/send";
import { isAffiliate } from "@/lib/roles";
import { cleanQuote } from "@/lib/quote/model";

type Made = { ok: true; token: string } | { ok: false; error: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function save(raw: unknown): Promise<Made> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return { ok: false, error: "Quotes are for affiliates." };
  const data = cleanQuote(raw);
  if (!data) return { ok: false, error: "Choose at least one product that has a price." };
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase.from("quotes").select("token", { count: "exact", head: true }).eq("user_id", session.user.id).gte("created_at", since);
  if ((count ?? 0) >= 60) return { ok: false, error: "That is a lot of quotes in an hour. Please wait a little." };
  const { data: row, error } = await supabase.from("quotes").insert({ user_id: session.user.id, data }).select("token").single();
  if (error || !row) return { ok: false, error: "We could not save that. Please try again." };
  return { ok: true, token: (row as { token: string }).token };
}

/** Saves a quote and gives back its share address. The base prices are never taken from the browser: only which products, the tax and the shipping. */
export async function createQuote(raw: unknown): Promise<Made> { return save(raw); }

export type LeadChoice = { email: string; name: string };

/** The person's own leads (people who filled in their page, and people they invited) to pick from. */
export async function myLeadChoices(): Promise<LeadChoice[]> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return [];
  const [{ data: forms }, { data: inv }] = await Promise.all([
    supabase.rpc("my_leads", { p_from: "2020-01-01T00:00:00Z", p_to: new Date(Date.now() + 86_400_000).toISOString() }),
    supabase.rpc("my_invites"),
  ]);
  const out = new Map<string, LeadChoice>();
  for (const l of (forms ?? []) as { email: string; first_name: string | null; last_name: string | null }[]) out.set(l.email.toLowerCase(), { email: l.email, name: [l.first_name, l.last_name].filter(Boolean).join(" ") });
  for (const l of (inv ?? []) as { email: string; first_name: string | null; last_name: string | null }[]) if (!out.has(l.email.toLowerCase())) out.set(l.email.toLowerCase(), { email: l.email, name: [l.first_name, l.last_name].filter(Boolean).join(" ") });
  return [...out.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "en", { sensitivity: "base" })).slice(0, 500);
}

/** Saves the quote and emails the link to a lead. */
export async function emailQuote(raw: unknown, to: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(to ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: "That email address does not look right." };
  const made = await save(raw);
  if (!made.ok) return made;
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Something went wrong." };
  const { error } = await supabase.rpc("queue_quote_email", { p_token: made.token, p_to: email, p_name: String(name ?? "").slice(0, 60) });
  if (error) return { ok: false, error: error.message.includes("too many") ? "You have sent a lot of emails today. Please try again tomorrow." : "We could not send that email. Please try again." };
  try { await drainOutbox(5); } catch { /* it goes out on the next round */ }
  return { ok: true };
}
