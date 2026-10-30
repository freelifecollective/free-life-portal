/** The choices for how long a call runs. The minutes are the longest the call can run (they decide when it counts as over). */
export const LENGTHS = [
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "1-1.5", label: "1-1.5 hours", minutes: 90 },
  { id: "1-2", label: "1-2 hours", minutes: 120 },
  { id: "1.5-2", label: "1.5-2 hours", minutes: 120 },
  { id: "2+", label: "2+ hours", minutes: 180 },
] as const;
export type LengthId = (typeof LENGTHS)[number]["id"];

export const lengthById = (id: string) => LENGTHS.find((l) => l.id === id);

/** Which choice a saved call corresponds to: its saved label, or failing that the one with the same number of minutes. */
export function lengthIdOf(call: { length_label?: string | null; duration_minutes: number }): LengthId | null {
  return (LENGTHS.find((l) => l.label === call.length_label) ?? LENGTHS.find((l) => l.minutes === call.duration_minutes))?.id ?? null;
}

/** How a call's length is shown to people: "1-1.5 hours", or "75 min" for older calls with a custom length. */
export function callLength(call: { length_label?: string | null; duration_minutes: number }): string {
  const known = LENGTHS.find((l) => l.label === call.length_label);
  return known ? known.label : `${call.duration_minutes} min`;
}
