import { addDays } from "@/lib/dashboard/range";
import { toZonedInput, zonedToUtc } from "@/lib/time";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-11" for the month a moment falls in (Eastern, like everything else on the calendar). */
export function monthOf(ms: number): string {
  return toZonedInput(new Date(ms)).slice(0, 7);
}

/** The start (included) and end (excluded) of a month as moments, or null for a value that is not "YYYY-MM". */
export function monthRange(m: string): { from: Date; to: Date } | null {
  const x = MONTH.exec(m);
  if (!x) return null;
  const y = +x[1], mo = +x[2];
  const from = zonedToUtc(`${m}-01T00:00`);
  const to = zonedToUtc(`${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}-01T00:00`);
  return from && to ? { from, to } : null;
}

/** Every month from `earliest` up to `now`, newest first, as { value: "2026-11", label: "November 2026" }. */
export function monthOptions(earliestMs: number, nowMs: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let [y, m] = monthOf(Math.min(earliestMs, nowMs)).split("-").map(Number);
  const [ey, em] = monthOf(nowMs).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1))) });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out.reverse();
}

/** The Monday of the week a "YYYY-MM-DD" day is in. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 is Sunday
  return addDays(day, -((dow + 6) % 7));
}

export const weekLabel = (start: string) =>
  `Week of ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${start}T12:00:00Z`))}`;

/** Groups rows (newest first) into weeks, newest week first. */
export function groupByWeek<T extends { created_at: string }>(rows: T[]): { start: string; label: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const start = weekStart(toZonedInput(new Date(r.created_at)).slice(0, 10));
    groups.set(start, [...(groups.get(start) ?? []), r]);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([start, list]) => ({ start, label: weekLabel(start), rows: list }));
}
