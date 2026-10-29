import { toZonedInput, zonedToUtc } from "@/lib/time";

export type DateRange = { from: string; to: string; fromIso: string; toIso: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST = "2024-01-01";

/** Adds whole days to a "YYYY-MM-DD" date without any time zone getting in the way. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The shortcuts shown above the date pickers. Dates are Eastern, like the calls. */
export function presets(today: string): { label: string; from: string; to: string }[] {
  return [
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: today.slice(0, 8) + "01", to: today },
    { label: "All time", from: EARLIEST, to: today },
  ];
}

/** Reads ?from=&to= (both "YYYY-MM-DD", both included). Anything missing or wrong falls back to the last 30 days. */
export function parseRange(from: string | undefined, to: string | undefined, nowMs: number): DateRange {
  const today = toZonedInput(new Date(nowMs)).slice(0, 10);
  let f = from && DAY.test(from) ? from : addDays(today, -29);
  let t = to && DAY.test(to) ? to : today;
  if (f > t) [f, t] = [t, f];
  if (f < EARLIEST) f = EARLIEST;
  const start = zonedToUtc(`${f}T00:00`) ?? new Date(`${f}T05:00:00Z`);
  const end = zonedToUtc(`${addDays(t, 1)}T00:00`) ?? new Date(`${addDays(t, 1)}T05:00:00Z`);
  return { from: f, to: t, fromIso: start.toISOString(), toIso: end.toISOString() };
}
