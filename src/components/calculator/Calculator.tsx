"use client";

import { useMemo, useState } from "react";
import { COMMISSIONS } from "@/lib/calculator/data";

const COMBO = /^(K8 \+ Ukon|Trifecta|Quad)/;
const POINTS = [1, 2, 3, 4, 5, 6, 7, 8];
const COLS = 6; // products per row on a full-width screen

/** Products that start a new row on a full-width screen (the row before it is left short). Narrow screens ignore this. */
const ROW_STARTS: Record<string, string[]> = {
  "United States": ["SD501U", "Beaute \u03a3"],
  Europe: ["JRIV"],
  "New Zealand": ["JRIV"],
  Mexico: ["JRIV"],
};
const countries = [...COMMISSIONS.countries].sort((a, b) => a.name.localeCompare(b.name));

/** Pick a country and your points, then tap products (and use + / − for more than one) to add up your estimated commission. */
export function Calculator({ initialCountry }: { initialCountry?: string }) {
  const [country, setCountry] = useState(COMMISSIONS.countries.some((x) => x.name === initialCountry) ? initialCountry! : COMMISSIONS.default);
  const [points, setPoints] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const c = COMMISSIONS.countries.find((x) => x.name === country) ?? COMMISSIONS.countries[0];
  const fmt = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: c.currency, maximumFractionDigits: 0 }), [c.currency]);

  let sum = 0, n = 0;
  for (const pr of c.products) { const q = qty[pr.name] ?? 0; sum += (pr.rates[String(points)] ?? 0) * q; n += q; }

  /* the products in order (packages last), with empty slots where a row must start fresh */
  const layout: ((typeof c.products)[number] | null)[] = [];
  for (const pr of [...c.products.filter((p) => !COMBO.test(p.name)), ...c.products.filter((p) => COMBO.test(p.name))]) {
    if ((ROW_STARTS[c.name] ?? []).includes(pr.name) && layout.length % COLS !== 0) while (layout.length % COLS !== 0) layout.push(null);
    layout.push(pr);
  }

  const add = (name: string, d: number) => setQty((s) => ({ ...s, [name]: Math.max(0, Math.min(99, (s[name] ?? 0) + d)) }));
  const toggle = (name: string) => setQty((s) => ({ ...s, [name]: s[name] ? 0 : 1 }));

  const bubble = (pr: (typeof c.products)[number]) => {
    const v = qty[pr.name] ?? 0;
    const amount = fmt.format(pr.rates[String(points)] ?? 0);
    return (
      <div key={pr.name} className={"calc-bubble" + (COMBO.test(pr.name) ? " combo" : "") + (v > 0 ? " on" : "")}>
        <button type="button" className="hit" aria-label={`${pr.name}, ${amount}${v ? `, ${v} selected. Deselect.` : ", not selected. Select."}`} onClick={() => toggle(pr.name)}>
          <span className="name">{pr.name}</span>
          <span className="amt">{amount}</span>
        </button>
        <div className="step" aria-hidden={v === 0}>
          <button type="button" tabIndex={v ? 0 : -1} aria-label={`Remove one ${pr.name}`} onClick={() => add(pr.name, -1)}>−</button>
          <span className="q" aria-live="polite">{v}</span>
          <button type="button" tabIndex={v ? 0 : -1} aria-label={`Add one ${pr.name}`} onClick={() => add(pr.name, 1)}>+</button>
        </div>
      </div>
    );
  };

  return (
    <div className="calc">
      <div className="calc-selects">
        <div className="field"><label htmlFor="calc-country">Country</label>
          <select id="calc-country" value={country} onChange={(e) => { setCountry(e.target.value); setQty({}); }}>{countries.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>
        <div className="field"><label htmlFor="calc-points">Points</label>
          <select id="calc-points" value={points} onChange={(e) => setPoints(Number(e.target.value))}>{POINTS.map((p) => <option key={p} value={p}>{p === 1 ? "1 point" : `${p} points`}</option>)}</select></div>
        <div className="calc-total" aria-live="polite">
          <div>
            <div className="lbl">Total commission</div>
            <div className="sub">{n ? `${n} ${n === 1 ? "item" : "items"}, ${points} ${points === 1 ? "point each" : "points each"}` : "Select products to add them up"}</div>
          </div>
          <div className="right">
            <button type="button" className="clear" disabled={!n} onClick={() => setQty({})}>Clear</button>
            <div className="sum">{fmt.format(sum)}</div>
          </div>
        </div>
      </div>
      <div className="calc-bubbles">{layout.map((item, i) => item === null ? <span key={`gap-${i}`} className="calc-gap" aria-hidden="true" /> : bubble(item))}</div>
    </div>
  );
}
