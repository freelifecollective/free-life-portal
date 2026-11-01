"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { calcCountryOf } from "@/lib/calculator/default";
import { computePay, type PayRule } from "@/lib/closer/pay";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type R = { ok: true } | { ok: false; error: string };
const refresh = () => revalidatePath("/call-closer");

export async function setPaused(paused: boolean): Promise<R> {
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("set_closer_paused", { p_paused: !!paused });
  if (error) return { ok: false, error: "We could not change that. Please try again." };
  refresh(); revalidatePath("/call-closers");
  return { ok: true };
}

/** Records how a past call went and what the lead bought. What is owed is worked out here from the hiring affiliate's rank and the Earnings Estimator figures. */
export async function saveCall(input: { id: string; outcome: string; points: number; products: Record<string, number> }): Promise<R> {
  if (!UUID.test(input.id)) return { ok: false, error: "Something went wrong." };
  if (input.outcome !== "took_place" && input.outcome !== "no_show") return { ok: false, error: "Choose whether the call took place." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const [{ data: inp }, { data: rules }] = await Promise.all([
    supabase.rpc("closer_call_inputs", { p_id: input.id }),
    supabase.from("closer_pay_rules").select("rank_from, rank_to, kind, amount").eq("closer_id", session.user.id),
  ]);
  const row = ((inp ?? []) as { member_id: string; rank_id: number | null; country: string | null; price_per_call_cents: number | null }[])[0];
  if (!row) return { ok: false, error: "That call is not yours." };
  const points = Math.min(8, Math.max(1, Math.round(Number(input.points) || 1)));
  const products: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.products ?? {})) { const q = Math.floor(Number(v)); if (k && k.length <= 120 && q >= 1) products[k] = Math.min(99, q); }
  const pay = computePay({
    rankId: row.rank_id, points, country: calcCountryOf(row.country) ?? "United States", products, callCents: row.price_per_call_cents,
    tookPlace: input.outcome === "took_place",
    rules: ((rules ?? []) as { rank_from: number; rank_to: number; kind: "flat" | "percent"; amount: number | string }[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PayRule[],
  });
  const { error } = await supabase.rpc("closer_save_call", {
    p_id: input.id, p_outcome: input.outcome, p_points: points, p_call_cents: pay.callCents, p_products_cents: pay.productCents, p_currency: pay.currency, p_products: products,
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  refresh();
  return { ok: true };
}

export async function markPaid(id: string, paid: boolean): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("closer_mark_paid", { p_id: id, p_paid: !!paid });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  refresh();
  return { ok: true };
}

/** Replaces the closer's pay rules. */
export async function saveRules(rules: { rank_from: number; rank_to: number; kind: string; amount: number }[]): Promise<R> {
  if (rules.length > 8) return { ok: false, error: "Up to 8 rules, please." };
  const clean: { rank_from: number; rank_to: number; kind: "flat" | "percent"; amount: number }[] = [];
  for (const r of rules) {
    const f = Math.round(r.rank_from), t = Math.round(r.rank_to), a = Number(r.amount);
    if (!(f >= 1 && f <= 7 && t >= f && t <= 7)) return { ok: false, error: "Each rule needs a first rank and a last rank, in order." };
    if (r.kind !== "flat" && r.kind !== "percent") return { ok: false, error: "Choose flat or percent." };
    if (!Number.isFinite(a) || a < 0 || (r.kind === "percent" && a > 100)) return { ok: false, error: "Check the amount." };
    clean.push({ rank_from: f, rank_to: t, kind: r.kind, amount: r.kind === "flat" ? Math.round(a * 100) : a });
  }
  for (let i = 0; i < clean.length; i++) for (let j = i + 1; j < clean.length; j++) if (clean[i].rank_from <= clean[j].rank_to && clean[j].rank_from <= clean[i].rank_to) return { ok: false, error: "Two rules cover the same rank. Change one of them." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const del = await supabase.from("closer_pay_rules").delete().eq("closer_id", session.user.id);
  if (del.error) return { ok: false, error: "We could not save that. Please try again." };
  if (clean.length) {
    const ins = await supabase.from("closer_pay_rules").insert(clean.map((r) => ({ ...r, closer_id: session.user.id })));
    if (ins.error) return { ok: false, error: "We could not save that. Please try again." };
  }
  refresh();
  return { ok: true };
}
