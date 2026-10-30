/** Badge families and their levels. Keep the numbers in step with badge_state() in migration 0032. */
export type Family = "followup" | "morning" | "cleared" | "community" | "masterclass";

export type FamilyDef = {
  id: Family; title: string; blurb: string; steps: number[]; unit: "days" | "calls"; icon: string;
  /** a short label for a level, such as "7 days in a row" or "10 calls" */
  label: (n: number) => string;
};

const days = (n: number) => (n === 90 ? "3 months in a row" : n === 180 ? "6 months in a row" : n === 365 ? "1 year in a row" : `${n} days in a row`);
const calls = (one: string, many: string) => (n: number) => (n === 1 ? `Your first ${one}` : `${n} ${many} attended`);

export const STREAK_STEPS = [7, 14, 30, 90, 180, 365];

export const FAMILIES: FamilyDef[] = [
  { id: "followup", title: "Lead Follow-Up", blurb: "Follow up with your leads every day. Name a task with “follow up” in it and tick it off.", steps: STREAK_STEPS, unit: "days", icon: "followup", label: days },
  { id: "morning", title: "Morning Routine", blurb: "Do your morning routine daily. Name a task with “morning” or “routine” in it and tick it off.", steps: STREAK_STEPS, unit: "days", icon: "morning", label: days },
  { id: "cleared", title: "List Cleared", blurb: "Clear your whole to-do list for the day. Do it every day to build the streak.", steps: STREAK_STEPS, unit: "days", icon: "cleared", label: days },
  { id: "community", title: "Community Calls", blurb: "Join our community calls live from the portal.", steps: [1, 5, 10, 25, 50, 100], unit: "calls", icon: "community", label: calls("community call", "community calls") },
  { id: "masterclass", title: "Masterclasses", blurb: "Join our masterclasses live from the portal.", steps: [1, 3, 5, 10, 25], unit: "calls", icon: "masterclass", label: calls("masterclass", "masterclasses") },
];

export const family = (id: string): FamilyDef | undefined => FAMILIES.find((f) => f.id === id);

/** "followup_7" -> { family: followup, n: 7 } */
export function parseKey(key: string): { def: FamilyDef; n: number } | null {
  const [f, num] = key.split("_");
  const def = family(f);
  const n = Number(num);
  return def && def.steps.includes(n) ? { def, n } : null;
}

/** How far along a level is: 0 for the first up to 5 for the sixth. Drives the medallion colour. */
export const tierOf = (def: FamilyDef, n: number) => Math.min(def.steps.indexOf(n), 5);

/** The next level to aim for, given where someone is. */
export function nextStep(def: FamilyDef, value: number): number | null {
  return def.steps.find((s) => s > value) ?? null;
}

export type BadgeState = {
  streaks: Record<"followup" | "morning" | "cleared", { current: number; best: number }>;
  attended: { community: number; masterclass: number };
  earned: { key: string; at: string }[];
  new: string[];
};

/** The number a family's progress is measured by: the best streak so far, or calls attended. */
export function progressOf(def: FamilyDef, s: BadgeState): { value: number; current?: number } {
  if (def.id === "community" || def.id === "masterclass") return { value: s.attended[def.id] };
  return { value: s.streaks[def.id].best, current: s.streaks[def.id].current };
}

/** Which streak a task counts toward, judged from its title (so a task called "Morning outreach" counts as a morning routine). */
export function tagOf(title: string): "followup" | "morning" | null {
  if (/follow(ed|ing)?[\s-]?ups?\b|follow(ed|ing)? up/i.test(title)) return "followup";
  if (/\bmorning\b|\broutine\b/i.test(title)) return "morning";
  return null;
}
