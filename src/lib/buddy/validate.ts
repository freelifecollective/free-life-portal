import { MINLEN, PNA, QUESTIONS, RANKS, type Question } from "./questions";

export type Answer = string | number | string[] | { city: string; tz: string };
export type Answers = Record<string, Answer>;

/** One question's answer is acceptable. The same rules run in the browser and on the server. */
export function isValid(q: Question, a: unknown): boolean {
  switch (q.t) {
    case "city": return !!a && typeof a === "object" && !Array.isArray(a) && typeof (a as { tz?: unknown }).tz === "string" && (a as { tz: string }).tz.length > 0;
    case "single":
    case "select": return typeof a === "string" && (q.o ?? []).includes(a);
    case "multi": {
      if (!Array.isArray(a) || a.length < 1 || !a.every((x) => typeof x === "string" && (q.o ?? []).includes(x))) return false;
      if (q.max && a.length > q.max) return false;
      if (q.excl && a.some((x) => q.excl!.includes(x)) && a.length > 1) return false;
      return new Set(a).size === a.length;
    }
    case "text": return typeof a === "string" && a.trim().length >= MINLEN && a.length <= 600;
    case "number": return a === PNA || (typeof a === "number" && Number.isInteger(a) && a >= (q.min ?? 0) && a <= (q.max ?? 120));
  }
}

/** Drops anything that no longer fits a question (for example an option that was renamed). */
export function cleanAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const q of QUESTIONS) {
    const a = src[q.k];
    if (a === undefined) continue;
    if (q.t === "text" ? typeof a === "string" : isValid(q, a)) out[q.k] = a as Answer;
  }
  return out;
}

export const firstIncomplete = (a: Answers): number => QUESTIONS.findIndex((q) => !isValid(q, a[q.k]));
export const isComplete = (a: Answers): boolean => firstIncomplete(a) === -1;
/** 1A = 1 ... 6A+ = 7, matching the ranks table. */
export const rankId = (rank: unknown): number | null => { const i = RANKS.indexOf(rank as (typeof RANKS)[number]); return i < 0 ? null : i + 1; };
