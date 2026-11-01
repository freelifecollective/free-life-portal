import type { SupabaseClient } from "@supabase/supabase-js";
import { BlockedDates, GoogleCalendarCard, type Blocked } from "@/components/booking/BlockedDates";
import { googleConfigured } from "@/lib/google/calendar";
import { AvailabilityForm } from "@/components/booking/AvailabilityForm";
import { DEFAULT_RULES, type Hours, type Rules } from "@/lib/booking/times";
import { nowMs } from "@/lib/time";
import { getTz } from "@/lib/tasks/queries";

/** The weekly hours and booking rules for one person, ready to edit. */
export async function AvailabilityPanel({ supabase, userId, googleStatus = null }: { supabase: SupabaseClient; userId: string; googleStatus?: string | null }) {
  const [{ data: hours }, { data: cs }, tzDefault, { data: bl }, { data: g }] = await Promise.all([
    supabase.from("coach_availability").select("weekday, start_min, end_min").eq("member_id", userId),
    supabase.from("coach_settings").select("call_minutes, tz, interval_minutes, min_notice_hours, max_days_ahead, buffer_before, buffer_after, max_per_day").eq("member_id", userId).maybeSingle(),
    getTz(supabase),
    supabase.from("coach_blocked_dates").select("day, note").eq("member_id", userId).gte("day", new Date(nowMs() - 86_400_000).toISOString().slice(0, 10)).order("day").limit(200),
    supabase.rpc("my_google_calendar"),
  ]);
  const zones = Intl.supportedValuesOf("timeZone");
  const row = cs as (Rules & { tz: string }) | null;
  const tz = row?.tz ?? tzDefault;
  const rules: Rules = row ? { call_minutes: row.call_minutes, interval_minutes: row.interval_minutes, min_notice_hours: row.min_notice_hours, max_days_ahead: row.max_days_ahead, buffer_before: row.buffer_before, buffer_after: row.buffer_after, max_per_day: row.max_per_day } : DEFAULT_RULES;
  const today = new Date(nowMs()).toISOString().slice(0, 10);
  const email = ((g ?? []) as { email: string | null }[])[0]?.email ?? null;
  return (
    <div className="av-stack">
      <AvailabilityForm hours={(hours ?? []) as Hours[]} rules={rules} tz={zones.includes(tz) ? tz : "America/New_York"} zones={zones} />
      <BlockedDates blocked={(bl ?? []) as Blocked[]} today={today} />
      <GoogleCalendarCard configured={googleConfigured} email={email} status={googleStatus} />
    </div>
  );
}
