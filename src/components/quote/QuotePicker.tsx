"use client";

import { useState } from "react";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { expandSelection } from "@/lib/quote/model";

/** What can go on a quote. The first three are single products, the rest are packages (shown as their products on the quote). */
const CHOICES: { name: string; label: string }[] = [
  { name: "Anespa", label: "Anespa DX" },
  { name: "K8", label: "Kangen 8" },
  { name: "Ukon Sigma", label: "Ukon Sigma" },
  { name: "K8 + Ukon \u03a3", label: "K8 + Ukon" },
  { name: "Trifecta (Anespa, K8, Ukon \u03a3)", label: "Trifecta" },
  { name: "Quad (Anespa, K8 x2, Ukon \u03a3)", label: "Quad" },
];

export function QuotePicker() {
  const [qty, setQty] = useState<Record<string, number>>({});
  const add = (name: string, d: number) => setQty((s) => ({ ...s, [name]: Math.max(0, Math.min(10, (s[name] ?? 0) + d)) }));
  const products = expandSelection(qty);
  return (
    <div className="qp">
      <h2 className="qh" style={{ marginTop: 0 }}>1. Choose the products</h2>
      <div className="calc-bubbles qp-bubbles">
        {CHOICES.map((c) => {
          const v = qty[c.name] ?? 0;
          return (
            <div key={c.name} className={"calc-bubble" + (c.name.match(/^(K8 \+|Trifecta|Quad)/) ? " combo" : "") + (v > 0 ? " on" : "")}>
              <button type="button" className="hit" aria-label={`${c.label}${v ? `, ${v} selected. Deselect.` : ", not selected. Select."}`} onClick={() => setQty((s) => ({ ...s, [c.name]: s[c.name] ? 0 : 1 }))}>
                <span className="name" data-i18n="skip">{c.label}</span>
              </button>
              <div className="step" aria-hidden={v === 0}>
                <button type="button" tabIndex={v ? 0 : -1} aria-label={`Remove one ${c.label}`} onClick={() => add(c.name, -1)}>−</button>
                <span className="q" aria-live="polite">{v}</span>
                <button type="button" tabIndex={v ? 0 : -1} aria-label={`Add one ${c.label}`} onClick={() => add(c.name, 1)}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {products ? (
        <>
          <h2 className="qh" style={{ marginTop: 28 }}>2. Make the quote</h2>
          <QuoteBuilder products={products} startOpen />
        </>
      ) : <p className="when" style={{ margin: "14px 0 0" }}>Pick at least one product to start your quote.</p>}
    </div>
  );
}
