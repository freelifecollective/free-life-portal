"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";
import { nowMs, toZonedInput } from "@/lib/time";

export type MyMilestoneState = { error: string; done: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** You log your own coaching calls and sales. They count toward your badges. */
export async function logMyMilestone(_prev: MyMilestoneState, form: FormData): Promise<MyMilestoneState> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return { error: "This is for affiliates.", done: "" };
  const kind = String(form.get("kind") ?? "");
  const day = String(form.get("day") ?? "");
  const count = Math.floor(Number(form.get("count") ?? 1));
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  if (kind !== "coaching" && kind !== "sale") return { error: "Choose coaching call or sale.", done: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > toZonedInput(new Date(nowMs())).slice(0, 10)) return { error: "Choose a date that has already happened.", done: "" };
  if (!Number.isInteger(count) || count < 1 || count > 20) return { error: "The number must be between 1 and 20.", done: "" };
  const rows = Array.from({ length: count }, () => ({ member_id: session.user.id, kind, happened_on: day, note: note || null, logged_by: session.user.id }));
  const { error } = await supabase.from("milestone_events").insert(rows);
  if (error) return { error: "We could not save that. Please try again.", done: "" };
  revalidatePath("/settings");
  return { error: "", done: `Logged ${count} ${kind === "sale" ? (count === 1 ? "sale" : "sales") : count === 1 ? "coaching call" : "coaching calls"}. Any new badge appears the next time you open the portal.` };
}

export async function removeMyMilestone(form: FormData): Promise<void> {
  const { session, supabase } = await requireMember();
  const id = String(form.get("id") ?? "");
  if (!supabase || !UUID.test(id)) return;
  await supabase.from("milestone_events").delete().eq("id", id).eq("member_id", session.user.id).eq("logged_by", session.user.id);
  revalidatePath("/settings");
}
