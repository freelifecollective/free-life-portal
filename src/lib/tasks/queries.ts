import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nowMs, toZonedInput } from "@/lib/time";
import type { Task } from "./schedule";

export const DEFAULT_TZ = "America/New_York";

export function validZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length < 1 || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** The person's saved time zone (the browser fills it in on the Tasks page). */
export async function getTz(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("member_prefs").select("tz").maybeSingle();
  return validZone(data?.tz) ? data.tz : DEFAULT_TZ;
}

/** Today's date ("YYYY-MM-DD") where the person is. */
export function todayIn(tz: string): string {
  return toZonedInput(new Date(nowMs()), tz).slice(0, 10);
}

export async function listTasks(supabase: SupabaseClient): Promise<Task[]> {
  const { data } = await supabase.from("tasks").select("id, area, title, note, repeat, due_on, position, done_on, prev_due_on").order("position").order("created_at").limit(500);
  return (data ?? []) as Task[];
}
