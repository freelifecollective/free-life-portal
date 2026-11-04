"use client";

import { useState } from "react";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { COMMISSIONS } from "@/lib/calculator/data";
import { COMBO, layoutProducts } from "@/lib/calculator/layout";
import { expandSelection, money } from "@/lib/quote/model";
import { priceOf } from "@/lib/quote/prices";

const countries = [...COMMISSIONS.countries].sort((a, b) => a.name.localeCompare(b.name));

/** Looks like the Earnings Estimator: pick a country, then tap products (with + and −), but each one shows its price instead of the commission. */
export function QuotePicker({ initialCountry }: { initialCountry?: string }) {
  const [country, setCountry] = useState(COMMISSIONS.countries.some((x) => x.name === initialCountry) ? initialCountry! : COMMISSIONS.default);
  const [qty, setQty] = useState<Record<string, number>>({});
  const c = COMMISSIONS.countries.find((x) => x.name === country) ?? COMMISSIONS.countries[0];
  const layout = layoutProducts(c);
  const products = expandSelection(country, qty);
  const add = (name: string, d: number) => setQty((s) => ({ ...s, [name]: Math.max(0, Math.min(10, (s[name] ?? 0) + d)) }));
  const toggle = (name: string) => setQty((s) => ({ ...s, [name]: s[name] ? 0 : 1 }));

  return (
    <div className="qp">
      <div className="calc-selects">
        <div className="field"><label htmlFor="qp-country">Country</label>
          <select id="qp-country" value={country} onChange={(e) => { setCountry(e.target.value); setQty({}); }}>{countries.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>
      </div>
      <div className="calc-bubbles">
        {layout.map((pr, i) => {
          if (pr === null) return <span key={`gap-${i}`} className="calc-gap" aria-hidden="true" />;
          const price = priceOf(country, pr.name);
          const v = qty[pr.name] ?? 0;
          return (
            <div key={pr.name} className={"calc-bubble" + (COMBO.test(pr.name) ? " combo" : "") + (v > 0 ? " on" : "") + (price === null ? " soon" : "")}>
              <button type="button" className="hit" disabled={price === null} aria-label={`${pr.name}, ${price === null ? "price coming soon" : money(price, c.currency)}${v ? `, ${v} selected. Deselect.` : price === null ? "" : ", not selected. Select."}`} onClick={() => toggle(pr.name)}>
                <span className="name">{pr.name}</span>
                <span className="amt">{price === null ? "—" : money(price, c.currency)}</span>
                {price === null ? <span className="soon-tag">Price coming soon</span> : null}
              </button>
              <div className="step" aria-hidden={v === 0}>
                <button type="button" tabIndex={v ? 0 : -1} aria-label={`Remove one ${pr.name}`} onClick={() => add(pr.name, -1)}>−</button>
                <span className="q" aria-live="polite">{v}</span>
                <button type="button" tabIndex={v ? 0 : -1} aria-label={`Add one ${pr.name}`} onClick={() => add(pr.name, 1)}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {products ? (
        <>
          <h2 className="qh" style={{ margin: "26px 0 12px" }}>Your quote</h2>
          <QuoteBuilder key={country} country={country} products={products} />
        </>
      ) : <p className="when" style={{ margin: "14px 0 0" }}>Pick at least one product to start your quote.</p>}
    </div>
  );
}
