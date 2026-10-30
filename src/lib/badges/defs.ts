/** Badge families and their levels. Keep the numbers in step with badge_state() in migrations 0032 and 0033. */
export type Family = "followup" | "morning" | "cleared" | "community" | "masterclass" | "replays" | "answers" | "coaching" | "sales";

export type FamilyDef = {
  id: Family; title: string; blurb: string; icon: string;
  /** the fixed levels, or null when the levels keep going (see `isStep`) */
  steps: number[] | null;
  isStep: (n: number) => boolean;
  /** for levels that keep going: the position of a level in the list (0 is the first) */
  position?: (n: number) => number;
  label: (n: number) => string;
};

const days = (n: number) => (n === 90 ? "3 months in a row" : n === 180 ? "6 months in a row" : n === 365 ? "1 year in a row" : `${n} days in a row`);
const fixed = (steps: number[]) => ({ steps, isStep: (n: number) => steps.includes(n) });

export const STREAK_STEPS = [7, 14, 30, 90, 180, 365];

export const FAMILIES: FamilyDef[] = [
  { id: "followup", title: "Lead Follow-Up", blurb: "Followed up with leads", icon: "followup", ...fixed(STREAK_STEPS), label: days },
  { id: "morning", title: "Morning Routine", blurb: "Did their morning routine", icon: "morning", ...fixed(STREAK_STEPS), label: days },
  { id: "cleared", title: "List Cleared", blurb: "Cleared their to-do list", icon: "cleared", ...fixed(STREAK_STEPS), label: days },
  { id: "community", title: "Community Calls", blurb: "Showed up live", icon: "community", ...fixed([1, 5, 10, 25, 50, 100]), label: (n) => (n === 1 ? "First community call" : `${n} community calls`) },
  { id: "masterclass", title: "Masterclasses", blurb: "Showed up live", icon: "masterclass", ...fixed([1, 3, 5, 10, 25]), label: (n) => (n === 1 ? "First masterclass" : `${n} masterclasses`) },
  { id: "replays", title: "Replay Watcher", blurb: "Watched call replays", icon: "replays", ...fixed([1, 5, 10, 25, 50, 100]), label: (n) => (n === 1 ? "First replay watched" : `${n} replays watched`) },
  { id: "answers", title: "Chat Helper", blurb: "Responded to questions in the chats", icon: "answers", ...fixed([100, 250, 500, 1000]), label: (n) => `Responded to ${n.toLocaleString("en-US")} questions` },
  { id: "coaching", title: "Coaching Calls", blurb: "Took coaching calls", icon: "coaching", steps: null, isStep: (n) => n === 1 || (n >= 10 && n % 10 === 0), position: (n) => (n === 1 ? 0 : n / 10), label: (n) => (n === 1 ? "First coaching call" : `${n} coaching calls`) },
  { id: "sales", title: "Sales", blurb: "Made sales", icon: "sales", steps: null, isStep: (n) => n === 1 || n === 5 || (n >= 10 && n % 10 === 0), position: (n) => (n === 1 ? 0 : n === 5 ? 1 : n / 10 + 1), label: (n) => (n === 1 ? "First sale" : `${n} sales`) },
];

export const family = (id: string): FamilyDef | undefined => FAMILIES.find((f) => f.id === id);

/** "followup_7" -> { family: followup, n: 7 } (null for anything that is not a real badge) */
export function parseKey(key: string): { def: FamilyDef; n: number } | null {
  const [f, num] = key.split("_");
  const def = family(f);
  const n = Number(num);
  return def && Number.isInteger(n) && n > 0 && def.isStep(n) ? { def, n } : null;
}

/** How far along a level is, 0 for the first up to 5 for the sixth and beyond. Drives the medallion colour. */
export function tierOf(def: FamilyDef, n: number): number {
  const i = def.steps ? def.steps.indexOf(n) : def.position ? def.position(n) : 0;
  return Math.min(Math.max(i, 0), 5);
}

export type BadgeState = {
  streaks: Record<"followup" | "morning" | "cleared", { current: number; best: number }>;
  attended: { community: number; masterclass: number };
  counts?: { community: number; masterclass: number; answers: number; coaching: number; sales: number; replays?: number };
  earned: { key: string; at: string }[];
  new: string[];
};

/** Which streak a task counts toward, judged from its title (so a task called "Morning outreach" counts as a morning routine). */
export function tagOf(title: string): "followup" | "morning" | null {
  if (/follow(ed|ing)?[\s-]?ups?\b|follow(ed|ing)? up/i.test(title)) return "followup";
  if (/\bmorning\b|\broutine\b/i.test(title)) return "morning";
  return null;
}

/** Earned badge keys, newest first. */
export function newestFirst(earned: { key: string; at: string }[]): string[] {
  return [...earned].sort((a, b) => b.at.localeCompare(a.at)).map((e) => e.key);
}
