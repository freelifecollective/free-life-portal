/** Busy stretches from a calendar, as milliseconds since 1970. */
export type Busy = { start: number; end: number };

/** Keeps only the call times that do not overlap anything busy. A call at `slot` lasts `minutes`. */
export function dropBusy(slots: string[], busy: Busy[], minutes: number): string[] {
  if (busy.length === 0) return slots;
  const len = minutes * 60_000;
  return slots.filter((s) => {
    const a = new Date(s).getTime();
    const b = a + len;
    return !busy.some((x) => x.start < b && x.end > a);
  });
}
