"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { SUPABASE_URL } from "@/lib/env";

function checkCard(c: { cover: string; location: string; experienceText: string; bio: string }): string | null {
  if (!c.cover) return "Please add your cover photo.";
  if (!c.location || c.location.length > 80) return "Tell us where you are (up to 80 characters).";
  if (!c.experienceText || c.experienceText.length > 40) return "Tell us your experience, like 2.5 years (up to 40 characters).";
  if (!c.bio || c.bio.length > 600) return "Write a short bio (up to 600 characters).";
  return null;
}

export type ApplyState = { error: string; sent?: boolean };

/** A member applies to become a call closer. An admin approves or declines it. */
export async function applyAsCloser(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const cover = String(form.get("cover_url") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const experienceText = String(form.get("experience_text") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const calls = String(form.get("calls_taken") ?? "").trim().slice(0, 40);
  const availability = String(form.get("availability") ?? "").trim();
  const pitch = String(form.get("pitch") ?? "").trim();
  const priceCall = String(form.get("price_per_call") ?? "").trim();
  const priceSale = String(form.get("price_per_sale") ?? "").trim();
  const card = checkCard({ cover, location, experienceText, bio });
  if (card) return { error: card };
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
  if (!cover.startsWith(`${SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`)) return { error: "Please add your cover photo." };
  const { error } = await supabase.from("closer_applications").insert({
    member_id: session.user.id, cover_url: cover, location, experience_text: experienceText, bio, calls_taken: calls || null, availability, pitch, price_per_call_cents: cents, price_per_sale: priceSale || null, agreed: true,
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

/** A call closer changes their own cover card. */
export async function saveMyCard(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const cover = String(form.get("cover_url") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const experienceText = String(form.get("experience_text") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const bad = checkCard({ cover: cover || "keep", location, experienceText, bio });
  if (bad) return { error: bad };
  const { session, supabase } = await requireMember();
  if (!supabase) return { error: "This needs the database." };
  if (cover && !cover.startsWith(`${SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`)) return { error: "Your picture did not upload. Please try again." };
  const { error } = await supabase.rpc("save_my_closer_card", { p_cover: cover, p_location: location, p_experience: experienceText, p_bio: bio });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return { error: "Cover cards need a database update that has not been run yet. Ask Claude for the SQL step." };
    return { error: "We could not save that. Please try again." };
  }
  revalidatePath("/call-closers");
  return { error: "", sent: true };
}

/** A call closer accepts or declines a hire request. */
export async function respondHire(id: string, accept: boolean, note: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("respond_closer_hire", { p_id: id, p_accept: accept, p_note: note.trim().slice(0, 200) || null });
  if (error) return { ok: false, error: "We could not save that. The request may have been taken back." };
  revalidatePath("/call-closers");
  return { ok: true };
}
