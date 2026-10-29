import { QUOTES, QUOTE_STYLES, type Quote, type QuoteStyle } from "./data";

export { QUOTE_STYLES, type Quote, type QuoteStyle };

export function isQuoteStyle(v: unknown): v is QuoteStyle {
  return v === "general" || v === "faith" || v === "spiritual";
}

/** Whole days since 2024-01-01 for a "YYYY-MM-DD" date (a plain count, so everyone on the same date gets the same quote). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2024, 0, 1)) / 86_400_000);
}

/** One quote per day. The list is walked in order and starts over at the end. */
export function quoteFor(style: QuoteStyle, day: string): Quote {
  const list = QUOTES[style];
  const n = ((dayNumber(day) % list.length) + list.length) % list.length;
  return list[n];
}
