import { addDays } from "@/lib/dashboard/range";
import { addMonths } from "@/lib/dashboard/payments";

export const REPEATS = ["daily", "weekly", "monthly", "quarterly", "annual", "once"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABEL: Record<Repeat, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", once: "One-off" };
export type Area = "business" | "personal";

export type Task = {
  id: string; area: Area; title: string; note: string | null; repeat: Repeat;
  due_on: string | null; position: number; done_on: string | null; prev_due_on: string | null;
};

/** Whole days from `a` to `b` (both "YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  const t = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

const MONTHS: Partial<Record<Repeat, number>> = { monthly: 1, quarterly: 3, annual: 12 };

/** The next due date after `today` for a repeating task. Steps always count from the original date so the day of the month does not drift. */
export function nextDue(due: string, repeat: Repeat, today: string): string {
  if (repeat === "daily" || repeat === "once") return due;
  let k = 1;
  for (;;) {
    const n = repeat === "weekly" ? addDays(due, 7 * k) : addMonths(due, (MONTHS[repeat] ?? 1) * k);
    if (n > today) return n;
    k++;
  }
}

export type State =
  | { kind: "done" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "daily" }
  | { kind: "anytime" }
  | { kind: "upcoming"; days: number };

/** Where a task stands today. "done" means ticked off today (or a finished one-off). */
export function stateOf(t: Task, today: string): State {
  if (t.done_on === today || (t.repeat === "once" && t.done_on)) return { kind: "done" };
  if (t.repeat === "daily") return { kind: "daily" };
  if (!t.due_on) return { kind: "anytime" };
  const d = daysBetween(today, t.due_on);
  if (d < 0) return { kind: "overdue", days: -d };
  if (d === 0) return { kind: "today" };
  return { kind: "upcoming", days: d };
}

/** Ticking a task off: repeating tasks jump to their next date (and remember the old one so it can be un-ticked). */
export function complete(t: Task, today: string): Task {
  const next = t.due_on && t.repeat !== "once" && t.repeat !== "daily" ? nextDue(t.due_on, t.repeat, today) : t.due_on;
  return { ...t, done_on: today, prev_due_on: t.due_on, due_on: next };
}
export function undo(t: Task): Task {
  return { ...t, done_on: null, due_on: t.prev_due_on ?? t.due_on, prev_due_on: null };
}

export type Split = { todayList: Task[]; upcoming: Task[]; doneToday: Task[] };

/** Splits everything into what to do today (in the person's own order), what is coming, and what is done today. */
export function split(tasks: Task[], today: string): Split {
  const todayList: Task[] = [], upcoming: Task[] = [], doneToday: Task[] = [];
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) {
    const s = stateOf(t, today);
    if (s.kind === "done") { if (t.done_on === today) doneToday.push(t); }
    else if (s.kind === "upcoming") upcoming.push(t);
    else todayList.push(t);
  }
  upcoming.sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  return { todayList, upcoming, doneToday };
}

/** "Due today", "Overdue by 2 days", "Due in 3 days", "Every day" and so on. */
export function dueLabel(t: Task, today: string): string {
  const s = stateOf(t, today);
  switch (s.kind) {
    case "overdue": return s.days === 1 ? "Overdue by 1 day" : `Overdue by ${s.days} days`;
    case "today": return "Due today";
    case "daily": return "Every day";
    case "anytime": return "No due date";
    case "upcoming": return s.days === 1 ? "Due tomorrow" : `Due in ${s.days} days`;
    default: return "Done";
  }
}

export type Suggestion = { ids: string[]; reasons: Record<string, string>; note: string };

/**
 * A sensible order for today: overdue first (oldest first), then what is due today, then daily routines, then things with no
 * deadline. Inside each group business tasks sit together and personal tasks sit together, so there is less switching between
 * two kinds of thinking. Anything else keeps the person's own order.
 */
export function suggestOrder(todayList: Task[], today: string): Suggestion {
  const rank = (t: Task): [number, number] => {
    const s = stateOf(t, today);
    if (s.kind === "overdue") return [0, -s.days];
    if (s.kind === "today") return [1, 0];
    if (s.kind === "daily") return [2, 0];
    return [3, 0];
  };
  const sorted = [...todayList].map((t, i) => ({ t, i, r: rank(t) })).sort((a, b) =>
    a.r[0] - b.r[0] || a.r[1] - b.r[1] || (a.t.area === b.t.area ? 0 : a.t.area === "business" ? -1 : 1) || a.i - b.i);
  const reasons: Record<string, string> = {};
  for (const { t, r } of sorted) {
    reasons[t.id] = r[0] === 0 ? "Overdue. Clear it first so it stops weighing on you." : r[0] === 1 ? "Due today." : r[0] === 2 ? "A daily routine: do it early to keep the habit." : "No deadline, so it comes after the urgent things.";
  }
  return { ids: sorted.map((x) => x.t.id), reasons, note: "Business tasks are grouped together and personal tasks together, so you are not switching gears all day." };
}

export type Help = { tips: string[]; links: { label: string; href: string }[] };

const HELP_RULES: { test: RegExp; label: string; href: string }[] = [
  { test: /follow|reach out|message|dm\b|text|lead|prospect|objection/i, label: "Find the words in Verbiage + Objections", href: "/responses" },
  { test: /invite|share|send.*link|promote/i, label: "Copy your invite link on Home", href: "/" },
  { test: /call|webinar|rsvp|zoom|event/i, label: "Open the calendar", href: "/calendar" },
  { test: /commission|income|earn|pay\b|money/i, label: "Open the Earnings Estimator", href: "/calculator" },
  { test: /post|content|graphic|flyer|ad\b|ads\b|copy|script|guide|document/i, label: "Browse Documents", href: "/documents" },
  { test: /watch|replay|recording|learn|train|study/i, label: "Watch a call recording", href: "/calls" },
  { test: /buddy|accountab|check.?in/i, label: "Open Accountability Buddy", href: "/buddy" },
  { test: /fund|financ|budget|loan/i, label: "See Financing Options", href: "/financing" },
  { test: /outsourc|virtual assistant|\bva\b|delegate|hire/i, label: "Find help in Outsourcing", href: "/outsourcing" },
  { test: /water|map|filter/i, label: "Open the Water Share Map", href: "/water-map" },
  { test: /ask|question|stuck|advice/i, label: "Ask the community in Chats", href: "/chats" },
];

/** Little nudges to help get a task done: portal pages that fit the words in the title, plus a few habits that work for anything. */
export function taskHelp(t: Pick<Task, "title" | "note" | "area">): Help {
  const text = `${t.title} ${t.note ?? ""}`;
  const links = HELP_RULES.filter((r) => r.test.test(text)).slice(0, 3).map(({ label, href }) => ({ label, href }));
  const tips = [
    "Make it small: write down just the first 10-minute step, set a timer and start.",
    t.area === "business" ? "Do it before checking messages. Money tasks first, then the inbox." : "Put it in your calendar with a time, so it has a real place in your day.",
    "Stuck? Tell your accountability buddy or ask in Chats. Saying it out loud makes it easier to start.",
  ];
  return { tips, links };
}
