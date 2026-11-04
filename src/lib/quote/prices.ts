import { COMMISSIONS } from "@/lib/calculator/data";

/* Base prices for the quotes, by country and product (the same countries and products as the Earnings Estimator).
   A product with null still has a placeholder: it shows "coming soon" and cannot go on a quote yet.
   To add a price, replace its null below (or add it under the country in KNOWN). Nothing else needs to change. */
const KNOWN: Record<string, Record<string, number>> = {
  "United States": {
    "K8": 5480,
    "Anespa": 3180,
    "Ukon Sigma": 2580,
    "K8 + Ukon Σ": 8060,
    "Trifecta (Anespa, K8, Ukon Σ)": 11240,
    "Quad (Anespa, K8 x2, Ukon Σ)": 16720,
  },
};

export const PRICES: Record<string, Record<string, number | null>> = Object.fromEntries(
  COMMISSIONS.countries.map((c) => [c.name, Object.fromEntries(c.products.map((p) => [p.name, KNOWN[c.name]?.[p.name] ?? null]))]),
);
export const currencyOf = (country: string) => COMMISSIONS.countries.find((c) => c.name === country)?.currency ?? "USD";
export const priceOf = (country: string, product: string): number | null => PRICES[country]?.[product] ?? null;
export const knownCountry = (country: string) => COMMISSIONS.countries.some((c) => c.name === country);
