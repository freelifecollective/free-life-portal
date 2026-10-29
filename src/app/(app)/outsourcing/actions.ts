"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ListingState = { error: string; saved?: boolean };
type Result = { ok: boolean; error?: string };

export async function saveListing(_prev: ListingState, form: FormData): Promise<ListingState> {
  const headline = String(form.get("headline") ?? "").trim();
  const about = String(form.get("about") ?? "").trim();
  const tasks = [...new Set(String(form.get("tasks") ?? "").split(",").map((t) => t.trim()).filter(Boolean))];
  const rate = Math.round(Number(String(form.get("rate") ?? "").replace(/[^0-9.]/g, "")) * 100);
  const listed = form.get("listed") === "on";
  if (!headline || headline.length > 100) return { error: "Add a short headline of up to 100 characters." };
  if (about.length > 1500) return { error: "Keep the about text under 1500 characters." };
  if (tasks.length < 1 || tasks.length > 12 || tasks.some((t) => t.length > 40)) return { error: "List 1 to 12 tasks, separated by commas (each up to 40 characters)." };
  if (!Number.isFinite(rate) || rate < 100 || rate > 100000) return { error: "Enter an hourly rate between $1 and $1,000." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { error: "Only affiliates can list themselves." };
  const { error } = await supabase.from("outsourcing_profiles").upsert(
    { member_id: session.user.id, headline, about: about || null, tasks, hourly_rate_cents: rate, listed, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (error) return { error: "We could not save that. Please try again." };
  revalidatePath("/outsourcing");
  return { error: "", saved: true };
}

export async function removeListing(): Promise<Result> {
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("outsourcing_profiles").delete().eq("member_id", session.user.id);
  if (error) return { ok: false, error: "We could not remove that." };
  revalidatePath("/outsourcing");
  return { ok: true };
}

/** "I hired this person" on or off (turning it off also removes any review you left). */
export async function setHired(providerId: string, on: boolean): Promise<Result> {
  if (!UUID.test(providerId)) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = on
    ? await supabase.from("outsourcing_hires").upsert({ provider_id: providerId, hirer_id: session.user.id }, { onConflict: "provider_id,hirer_id", ignoreDuplicates: true })
    : await supabase.from("outsourcing_hires").delete().eq("provider_id", providerId).eq("hirer_id", session.user.id);
  if (error) return { ok: false, error: "We could not save that." };
  revalidatePath("/outsourcing");
  return { ok: true };
}

export async function saveReview(hireId: string, rating: number, review: string): Promise<Result> {
  if (!UUID.test(hireId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  const text = review.trim().slice(0, 1000);
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("outsourcing_hires").update({ rating, review: text || null }).eq("id", hireId).eq("hirer_id", session.user.id);
  if (error) return { ok: false, error: "We could not save your review." };
  revalidatePath("/outsourcing");
  return { ok: true };
}

export async function deleteReview(hireId: string): Promise<Result> {
  if (!UUID.test(hireId)) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  if (session.profile.role !== "admin") return { ok: false, error: "Only admins can remove reviews." };
  const { error } = await supabase.from("outsourcing_hires").update({ rating: null, review: null }).eq("id", hireId);
  if (error) return { ok: false, error: "We could not remove that." };
  revalidatePath("/outsourcing");
  return { ok: true };
}
