"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";

export type AdRow = { id: string; day: string; campaign: string | null; spend: number; leads: number; source: string };
export type AdRes = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addAdResult(v: { day: string; campaign: string; spend: number; leads: number }): Promise<AdRes> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return { ok: false, error: "Please sign in again." };
  const spend = Number(v.spend), leads = Math.floor(Number(v.leads));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.day)) return { ok: false, error: "Pick a date." };
  if (!Number.isFinite(spend) || spend < 0 || spend >= 1e7) return { ok: false, error: "Enter what you spent, like 25.50." };
  if (!Number.isFinite(leads) || leads < 0 || leads >= 1e6) return { ok: false, error: "Enter how many leads you got." };
  const { error } = await supabase.from("ad_results").insert({ user_id: session.user.id, day: v.day, campaign: v.campaign.trim().slice(0, 80) || null, spend, leads });
  if (error) return { ok: false, error: "That didn't save. Try again." };
  revalidatePath("/tracking/numbers");
  return { ok: true };
}

export async function deleteAdResult(id: string): Promise<AdRes> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role) || !UUID.test(id)) return { ok: false, error: "That didn't work." };
  const { error } = await supabase.from("ad_results").delete().eq("id", id).eq("user_id", session.user.id);
  if (error) return { ok: false, error: "That didn't delete. Try again." };
  revalidatePath("/tracking/numbers");
  return { ok: true };
}
