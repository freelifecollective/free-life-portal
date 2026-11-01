"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRules } from "@/app/(app)/call-closer/actions";
import { RANK_NAMES, type PayRule } from "@/lib/closer/pay";

type Row = { rank_from: number; rank_to: number; kind: "flat" | "percent"; value: string };

/** How you are paid for products, by the rank of the affiliate who hired you. For example 1A to 3A: $50 per product. 4A to 6A+: 8% of the commission. */
export function PayRules({ rules }: { rules: PayRule[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(rules.map((r) => ({ rank_from: r.rank_from, rank_to: r.rank_to, kind: r.kind, value: String(r.kind === "flat" ? r.amount / 100 : r.amount) })));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const save = () => start(async () => {
    setMsg("");
    const r = await saveRules(rows.map((x) => ({ rank_from: x.rank_from, rank_to: x.rank_to, kind: x.kind, amount: Number(x.value) })));
    setMsg(r.ok ? "Saved." : r.error);
    if (r.ok) router.refresh();
  });
  return (
    <div className="set-form">
      {rows.length === 0 ? <p className="when" style={{ margin: 0 }}>No rules yet, so you are only owed the call price. Add a rule to be paid for products.</p> : null}
      {rows.map((r, i) => (
        <div key={i} className="av-row on">
          <select value={r.rank_from} onChange={(e) => set(i, { rank_from: Number(e.target.value), rank_to: Math.max(Number(e.target.value), r.rank_to) })} aria-label="From rank">{RANK_NAMES.map((n, k) => <option key={n} value={k + 1}>{n}</option>)}</select>
          <span aria-hidden="true">to</span>
          <select value={r.rank_to} onChange={(e) => set(i, { rank_to: Number(e.target.value) })} aria-label="To rank">{RANK_NAMES.map((n, k) => (k + 1 >= r.rank_from ? <option key={n} value={k + 1}>{n}</option> : null))}</select>
          <select value={r.kind} onChange={(e) => set(i, { kind: e.target.value as Row["kind"] })} aria-label="How you are paid"><option value="flat">Flat amount per product</option><option value="percent">Percent of the total commission</option></select>
          <input type="text" inputMode="decimal" value={r.value} onChange={(e) => set(i, { value: e.target.value })} aria-label="Amount" style={{ width: 90, font: "inherit", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px" }} />
          <span>{r.kind === "flat" ? "per product" : "%"}</span>
          <button type="button" className="linkbtn danger" onClick={() => setRows((cur) => cur.filter((_, k) => k !== i))}>Remove</button>
        </div>
      ))}
      <div className="rs-actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn small" onClick={() => setRows((cur) => [...cur, { rank_from: 1, rank_to: 7, kind: "flat", value: "50" }])}>Add a rule</button>
        <button type="button" className="btn small primary" disabled={pending} onClick={save}>Save my rules</button>
        <span role="status" className="when">{msg}</span>
      </div>
    </div>
  );
}
