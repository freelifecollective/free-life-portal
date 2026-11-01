"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { CALL_LENGTHS, DAYS, toMin } from "@/lib/booking/times";
import { validZone } from "@/lib/tasks/queries";

export type HoursState = { error: string; saved?: boolean };

/** Saves when an affiliate (or their closer) is open for coaching calls: one stretch of time per weekday. */
export async function saveHours(_prev: HoursState, form: FormData): Promise<HoursState> {
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { error: "Open hours are for affiliates." };
  const mins = Number(form.get("call_minutes"));
  const tz = String(form.get("tz") ?? "");
  if (!(CALL_LENGTHS as readonly number[]).includes(mins)) return { error: "Choose how long a call is." };
  if (!validZone(tz)) return { error: "Choose your time zone." };
  const rows: { member_id: string; weekday: number; start_min: number; end_min: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`on_${d}`) !== "on") continue;
    const s = toMin(String(form.get(`from_${d}`) ?? "")), e = String(form.get(`to_${d}`) ?? "") === "24:00" ? 1440 : toMin(String(form.get(`to_${d}`) ?? ""));
    if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || s > 1410 || e > 1440 || e <= s) return { error: `${DAYS[d]}: the end time must be after the start time.` };
    if (e - s < mins) return { error: `${DAYS[d]}: that is shorter than one call.` };
    rows.push({ member_id: session.user.id, weekday: d, start_min: s, end_min: e });
  }
  const me = session.user.id;
  const a = await supabase.from("coach_settings").upsert({ member_id: me, call_minutes: mins, tz, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (a.error) return { error: "We could not save that. Please try again." };
  const del = await supabase.from("coach_availability").delete().eq("member_id", me);
  if (del.error) return { error: "We could not save that. Please try again." };
  if (rows.length) {
    const ins = await supabase.from("coach_availability").insert(rows);
    if (ins.error) return { error: "We could not save that. Please try again." };
  }
  revalidatePath("/settings/availability");
  return { error: "", saved: true };
}
