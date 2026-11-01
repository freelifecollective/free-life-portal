import type { SupabaseClient } from "@supabase/supabase-js";
import { AvailabilityForm } from "@/components/booking/AvailabilityForm";
import { DEFAULT_RULES, type Hours, type Rules } from "@/lib/booking/times";
import { getTz } from "@/lib/tasks/queries";

/** The weekly hours and booking rules for one person, ready to edit. */
export async function AvailabilityPanel({ supabase, userId }: { supabase: SupabaseClient; userId: string }) {
  const [{ data: hours }, { data: cs }, tzDefault] = await Promise.all([
    supabase.from("coach_availability").select("weekday, start_min, end_min").eq("member_id", userId),
    supabase.from("coach_settings").select("call_minutes, tz, interval_minutes, min_notice_hours, max_days_ahead, buffer_before, buffer_after, max_per_day").eq("member_id", userId).maybeSingle(),
    getTz(supabase),
  ]);
  const zones = Intl.supportedValuesOf("timeZone");
  const row = cs as (Rules & { tz: string }) | null;
  const tz = row?.tz ?? tzDefault;
  const rules: Rules = row ? { call_minutes: row.call_minutes, interval_minutes: row.interval_minutes, min_notice_hours: row.min_notice_hours, max_days_ahead: row.max_days_ahead, buffer_before: row.buffer_before, buffer_after: row.buffer_after, max_per_day: row.max_per_day } : DEFAULT_RULES;
  return <AvailabilityForm hours={(hours ?? []) as Hours[]} rules={rules} tz={zones.includes(tz) ? tz : "America/New_York"} zones={zones} />;
}
