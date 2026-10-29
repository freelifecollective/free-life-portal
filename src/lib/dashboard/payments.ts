import { addDays } from "./range";

export type UpcomingPayment = { date: string; amount_cents: number; currency: string; description: string };

/** Adds calendar months to a "YYYY-MM-DD" date, keeping the day (or the last day of a shorter month). */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * The next few monthly payments, worked out from the last one paid (same amount, one month apart).
 * Until a payment processor is connected this is an estimate, not a bill.
 */
export function upcomingPayments(last: { paid_on: string; amount_cents: number; currency: string; description: string } | null, today: string, count = 3): UpcomingPayment[] {
  if (!last) return [];
  const out: UpcomingPayment[] = [];
  for (let i = 1; out.length < count && i < 600; i++) {
    const date = addMonths(last.paid_on, i);
    if (date >= addDays(today, 0)) out.push({ date, amount_cents: last.amount_cents, currency: last.currency, description: last.description });
  }
  return out;
}
