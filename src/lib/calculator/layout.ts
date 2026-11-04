import type { CommissionCountry } from "./data";

/** Packages (they start with one of these words) come after the single products. */
export const COMBO = /^(K8 \+ Ukon|Trifecta|Quad)/;
export const COLS = 6; // products per row on a full-width screen

/** Products that start a new row on a full-width screen (the row before it is left short). Narrow screens ignore this. */
const ROW_STARTS: Record<string, string[]> = {
  "United States": ["SD501U", "Beaute Σ"],
  Europe: ["JRIV"],
  "New Zealand": ["JRIV"],
  Mexico: ["JRIV"],
};

/** The products in order (packages last), with empty slots (null) where a row must start fresh. Shared by the Earnings Estimator and Create a Quote so they look the same. */
export function layoutProducts(c: CommissionCountry): (CommissionCountry["products"][number] | null)[] {
  const layout: (CommissionCountry["products"][number] | null)[] = [];
  for (const pr of [...c.products.filter((p) => !COMBO.test(p.name)), ...c.products.filter((p) => COMBO.test(p.name))]) {
    if ((ROW_STARTS[c.name] ?? []).includes(pr.name) && layout.length % COLS !== 0) while (layout.length % COLS !== 0) layout.push(null);
    layout.push(pr);
  }
  return layout;
}
