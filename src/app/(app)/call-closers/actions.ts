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
