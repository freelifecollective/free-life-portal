"use client";

import { useState, useTransition } from "react";
import { saveQuoteStyle } from "@/app/(app)/settings/actions";
import { QUOTE_STYLES, type QuoteStyle as Style } from "@/lib/quotes";

/** Choose which kind of quote appears under "Welcome" on Home. Saves as soon as you pick. */
export function QuoteStyle({ current }: { current: Style }) {
  const [style, setStyle] = useState<Style>(current);
  const [msg, setMsg] = useState("");
  const [pending, run] = useTransition();
  function pick(s: Style) {
    setStyle(s); setMsg("");
    run(async () => { const r = await saveQuoteStyle(s); setMsg(r.ok ? "Saved. Your next quote will match." : r.error ?? ""); });
  }
  return (
    <div className="qs" role="radiogroup" aria-label="Daily quote style">
      {QUOTE_STYLES.map((o) => (
        <label key={o.id} className={"qs-opt" + (style === o.id ? " on" : "")}>
          <input type="radio" name="quote-style" value={o.id} checked={style === o.id} disabled={pending} onChange={() => pick(o.id)} />
          <span><strong>{o.label}</strong><small>{o.hint}</small></span>
        </label>
      ))}
      <p className="when" role="status" style={{ margin: 0 }}>{msg}</p>
    </div>
  );
}
