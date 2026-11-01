import { COMMISSIONS } from "@/lib/calculator/data";

/** How a closer is paid for products a lead buys, depending on the rank of the affiliate who hired them. Ranks run 1 (1A) to 7 (6A+). */
export type PayRule = { rank_from: number; rank_to: number; kind: "flat" | "percent"; amount: number };
export const RANK_NAMES = ["1A", "2A", "3A", "4A", "5A", "6A", "6A+"] as const;
export const rankName = (id: number) => RANK_NAMES[id - 1] ?? "";

/** The points the Earnings Estimator uses for a rank (1A is 1 point, up to 6A+ at 7). */
export const pointsOfRank = (rankId: number | null) => (rankId ? Math.min(8, Math.max(1, rankId)) : 1);

export function countryTable(name: string | null | undefined) {
  return COMMISSIONS.countries.find((c) => c.name === name) ?? COMMISSIONS.countries.find((c) => c.name === COMMISSIONS.default)!;
}

export type PayInput = { rankId: number | null; points: number; country: string | null; products: Record<string, number>; callCents: number | null; tookPlace: boolean; rules: PayRule[] };
export type PayResult = { currency: string; units: number; commissionCents: number; productCents: number; callCents: number; totalCents: number; rule: PayRule | null };

/**
 * What a closer is owed for one call: the call price (when it took place), plus for the products the lead bought either
 * a flat amount per product or a percentage of the total commission, using the rule for the hiring affiliate's rank.
 */
export function computePay(i: PayInput): PayResult {
  const table = countryTable(i.country);
  let units = 0, commission = 0;
  for (const p of table.products) {
    const q = Math.max(0, Math.min(99, Math.floor(i.products[p.name] ?? 0)));
    if (!q) continue;
    units += q;
    commission += (p.rates[String(i.points)] ?? 0) * q;
  }
  const commissionCents = Math.round(commission * 100);
  const rule = i.tookPlace && i.rankId ? i.rules.find((r) => i.rankId! >= r.rank_from && i.rankId! <= r.rank_to) ?? null : null;
  const productCents = !i.tookPlace || !rule ? 0 : rule.kind === "flat" ? Math.round(rule.amount) * units : Math.round((commissionCents * rule.amount) / 100);
  const callCents = i.tookPlace ? Math.max(0, i.callCents ?? 0) : 0;
  return { currency: table.currency, units, commissionCents, productCents, callCents, totalCents: callCents + productCents, rule };
}

export const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
