/** Calls are scheduled in Eastern time (EST in winter, EDT in summer) and shown to members in their own time too. */
export const CALL_ZONE = "America/New_York";

/** How far a zone is ahead of UTC at a given moment, in milliseconds (negative for the Americas). */
export function zoneOffsetMs(zone: string, utcMs: number): number {
  const parts: Record<string, number> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(utcMs)).forEach((p) => { if (p.type !== "literal") parts[p.type] = +p.value; });
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * "2026-11-04T19:00" as a wall-clock time in `zone` -> the UTC moment it happens.
 * Returns null for a time that does not exist (the hour skipped when clocks go forward) or a malformed value.
 * For the repeated hour when clocks go back it picks the first occurrence.
 */
export function zonedToUtc(local: string, zone: string = CALL_ZONE): Date | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(wall).getUTCMonth() !== mo - 1) return null; // e.g. 31 November
  let guess = wall - zoneOffsetMs(zone, wall);
  guess = wall - zoneOffsetMs(zone, guess);
  if (toZonedInput(new Date(guess), zone) === local) return new Date(guess);
  // the time might exist only on the other side of a change; try the neighbouring offset
  const alt = wall - zoneOffsetMs(zone, guess + 3600_000);
  if (toZonedInput(new Date(alt), zone) === local) return new Date(alt);
  return null;
}

/** A UTC moment as "YYYY-MM-DDTHH:mm" on the wall clock of `zone` (the format of a datetime-local field). */
export function toZonedInput(date: Date, zone: string = CALL_ZONE): string {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date).forEach((x) => { if (x.type !== "literal") p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Tue, Nov 4, 7:00 PM EST" */
export function formatInZone(date: Date, zone: string = CALL_ZONE, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(date);
}

/** "Tuesday, November 4" for grouping. */
export function formatDayInZone(date: Date, zone: string = CALL_ZONE, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "long", month: "long", day: "numeric" }).format(date);
}

export function endsAt(startsAt: Date, minutes: number): Date {
  return new Date(startsAt.getTime() + minutes * 60_000);
}

/** The current moment. Pages call this once per request and pass it down so every card agrees on "now". */
export function nowMs(): number {
  return Date.now();
}
