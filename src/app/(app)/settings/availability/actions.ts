"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { BUFFERS, CALL_LENGTHS, DAYS, DAYS_AHEAD, INTERVALS, NOTICE_HOURS, PER_DAY, toMin } from "@/lib/booking/times";
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
  const num = (k: string) => Number(form.get(k));
  const interval = String(form.get("interval_minutes") ?? "") === "" ? null : num("interval_minutes");
  const perDay = String(form.get("max_per_day") ?? "") === "" ? null : num("max_per_day");
  if (interval !== null && !(INTERVALS as readonly number[]).includes(interval)) return { error: "Choose how often a call can start." };
  if (!(NOTICE_HOURS as readonly number[]).includes(num("min_notice_hours"))) return { error: "Choose how much notice you need." };
  if (!(DAYS_AHEAD as readonly number[]).includes(num("max_days_ahead"))) return { error: "Choose how far ahead people can book." };
  if (!(BUFFERS as readonly number[]).includes(num("buffer_before")) || !(BUFFERS as readonly number[]).includes(num("buffer_after"))) return { error: "Choose a buffer time." };
  if (perDay !== null && !(PER_DAY as readonly number[]).includes(perDay)) return { error: "Choose the most calls per day." };
  const rows: { member_id: string; weekday: number; start_min: number; end_min: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`on_${d}`) !== "on") continue;
    const s = toMin(String(form.get(`from_${d}`) ?? "")), e = String(form.get(`to_${d}`) ?? "") === "24:00" ? 1440 : toMin(String(form.get(`to_${d}`) ?? ""));
    if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || s > 1410 || e > 1440 || e <= s) return { error: `${DAYS[d]}: the end time must be after the start time.` };
    if (e - s < mins) return { error: `${DAYS[d]}: that is shorter than one call.` };
    rows.push({ member_id: session.user.id, weekday: d, start_min: s, end_min: e });
  }
  const me = session.user.id;
  const a = await supabase.from("coach_settings").upsert({ member_id: me, call_minutes: mins, tz, interval_minutes: interval, min_notice_hours: num("min_notice_hours"), max_days_ahead: num("max_days_ahead"), buffer_before: num("buffer_before"), buffer_after: num("buffer_after"), max_per_day: perDay, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (a.error) return { error: "We could not save that. Please try again." };
  const del = await supabase.from("coach_availability").delete().eq("member_id", me);
  if (del.error) return { error: "We could not save that. Please try again." };
  if (rows.length) {
    const ins = await supabase.from("coach_availability").insert(rows);
    if (ins.error) return { error: "We could not save that. Please try again." };
  }
  revalidatePath("/settings/availability"); revalidatePath("/call-closer");
  return { error: "", saved: true };
}
