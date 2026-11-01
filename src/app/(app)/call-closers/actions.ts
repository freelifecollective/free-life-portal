"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

export type ApplyState = { error: string; sent?: boolean };

/** A member applies to become a call closer. An admin approves or declines it. */
export async function applyAsCloser(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const experience = String(form.get("experience") ?? "");
  const calls = String(form.get("calls_taken") ?? "").trim().slice(0, 40);
  const availability = String(form.get("availability") ?? "").trim();
  const pitch = String(form.get("pitch") ?? "").trim();
  const priceCall = String(form.get("price_per_call") ?? "").trim();
  const priceSale = String(form.get("price_per_sale") ?? "").trim();
  if (!["none", "some", "lots"].includes(experience)) return { error: "Tell us how much experience you have with sales calls." };
  if (!availability || availability.length > 400) return { error: "Tell us when you are available (up to 400 characters)." };
  if (!pitch || pitch.length > 1500) return { error: "Tell us why you would be a great call closer (up to 1500 characters)." };
  if (priceSale.length > 400) return { error: "Keep the price per sale under 400 characters." };
  let cents: number | null = null;
  if (priceCall) {
    const n = Number(priceCall.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: "Enter your price per call as a number, like 50." };
    cents = Math.round(n * 100);
  }
  if (form.get("agreed") !== "on") return { error: "Please tick the box to confirm you agree." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { error: "Applications are for affiliates." };
  const { error } = await supabase.from("closer_applications").insert({
    member_id: session.user.id, experience, calls_taken: calls || null, availability, pitch, price_per_call_cents: cents, price_per_sale: priceSale || null, agreed: true,
  });
  if (error) {
    if (error.code === "23505") return { error: "You already have an application waiting." };
    return { error: "We could not send your application. Please try again." };
  }
  revalidatePath("/call-closers");
  return { error: "", sent: true };
}

/** Takes back an application that has not been answered yet. */
export async function withdrawApplication(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("closer_applications").delete().eq("id", id);
  revalidatePath("/call-closers");
  return { ok: !error };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hire a call closer for one call, two calls, or every future call (calls: 1, 2 or 0 for every call). */
export async function hireCloser(closerId: string, calls: number, note: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(closerId) || ![0, 1, 2].includes(calls)) return { ok: false, error: "Choose one call, two calls or all my future calls." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Hiring is for affiliates." };
  const { error } = await supabase.rpc("hire_closer", { p_closer: closerId, p_calls: calls || null, p_note: note.trim().slice(0, 200) || null });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already have a call closer hired. End that one first." };
    return { ok: false, error: "We could not hire them. Please try again." };
  }
  revalidatePath("/call-closers");
  return { ok: true };
}

/** Stops the current hire; new calls go back to the coach. */
export async function endHire(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("end_closer_hire", { p_id: id });
  revalidatePath("/call-closers");
  return { ok: !error };
}
