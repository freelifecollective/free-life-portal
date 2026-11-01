"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCall } from "@/app/(app)/call-closer/actions";
import { calcCountryOf } from "@/lib/calculator/default";
import { computePay, countryTable, money, pointsOfRank, rankName, type PayRule } from "@/lib/closer/pay";
import type { HubCall } from "@/lib/closer/types";
import { createClient } from "@/lib/supabase/client";

type Inputs = { member_id: string; rank_id: number | null; country: string | null; price_per_call_cents: number | null };

const ruleText = (r: PayRule | null, cur: string) => !r ? "No rule for this rank" : r.kind === "flat" ? `${money(r.amount, cur)} per product` : `${r.amount}% of the total commission`;

/** Record how a call went and what the lead bought. You can come back and change it, because leads sometimes buy weeks later. */
export function CallEditor({ call, forName, rules, open, onClose }: { call: HubCall; forName: string; rules: PayRule[]; open: boolean; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [outcome, setOutcome] = useState<"took_place" | "no_show">(call.outcome ?? "took_place");
  const [points, setPoints] = useState<number>(call.pay_points ?? 1);
  const [qty, setQty] = useState<Record<string, number>>(call.products);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) { dlg.current?.close(); return; }
    if (!dlg.current?.open) dlg.current?.showModal();
    let live = true;
    void createClient().rpc("closer_call_inputs", { p_id: call.id }).then(({ data }) => {
      if (!live) return;
      const r = ((data ?? []) as Inputs[])[0] ?? null;
      setInputs(r);
      if (r && call.pay_points === null) setPoints(pointsOfRank(r.rank_id));
    });
    return () => { live = false; };
  }, [open, call.id, call.pay_points]);

  const country = calcCountryOf(inputs?.country) ?? "United States";
  const table = countryTable(country);
  const pay = computePay({ rankId: inputs?.rank_id ?? null, points, country, products: qty, callCents: inputs?.price_per_call_cents ?? 0, tookPlace: outcome === "took_place", rules });
  const add = (name: string, d: number) => setQty((s) => ({ ...s, [name]: Math.max(0, Math.min(99, (s[name] ?? 0) + d)) }));
  const submit = () => start(async () => {
    setError("");
    const r = await saveCall({ id: call.id, outcome, points, products: qty });
    if (!r.ok) { setError(r.error); return; }
    onClose(); router.refresh();
  });

  return (
    <dialog ref={dlg} className="rs-dialog ch-dialog" aria-label="Record this call" onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <div className="set-form">
        <h2 className="qh" style={{ margin: 0 }} translate="no">{`${call.lead_name}`}</h2>
        <p className="when" style={{ margin: 0 }}>{inputs ? `Hired by ${forName}${inputs.rank_id ? ` · rank ${rankName(inputs.rank_id)}` : " · no rank set"}` : "Loading…"}</p>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend className="when" style={{ padding: 0, marginBottom: 4 }}>Did the call take place?</legend>
          <label className="check" style={{ display: "flex", gap: 8 }}><input type="radio" name="out" checked={outcome === "took_place"} onChange={() => setOutcome("took_place")} /> Yes, it took place</label>
          <label className="check" style={{ display: "flex", gap: 8 }}><input type="radio" name="out" checked={outcome === "no_show"} onChange={() => setOutcome("no_show")} /> No, it did not take place</label>
        </fieldset>
        {outcome === "took_place" ? (
          <>
            <div className="field"><label htmlFor="ce-points">Points (from their rank)</label>
              <select id="ce-points" value={points} onChange={(e) => setPoints(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8].map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="field"><span className="when">What did the lead buy?</span>
              <div className="ch-products">
                {table.products.map((p) => {
                  const q = qty[p.name] ?? 0;
                  return (
                    <div key={p.name} className={"ch-prod" + (q ? " on" : "")}>
                      <button type="button" className="ch-prod-name" onClick={() => setQty((s) => ({ ...s, [p.name]: s[p.name] ? 0 : 1 }))} translate="no">{p.name}</button>
                      {q ? <span className="ch-step"><button type="button" aria-label={`Remove one ${p.name}`} onClick={() => add(p.name, -1)}>−</button><b>{q}</b><button type="button" aria-label={`Add one ${p.name}`} onClick={() => add(p.name, 1)}>+</button></span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
        <div className="ch-sum">
          <p><span>Call price</span><b>{money(pay.callCents, pay.currency)}</b></p>
          {outcome === "took_place" ? (
            <>
              <p><span>Products bought</span><b>{pay.units}</b></p>
              <p><span>Total commission on them</span><b>{money(pay.commissionCents, pay.currency)}</b></p>
              <p><span>{ruleText(pay.rule, pay.currency)}</span><b>{money(pay.productCents, pay.currency)}</b></p>
            </>
          ) : null}
          <p className="ch-total"><span>You are owed</span><b>{money(pay.totalCents, pay.currency)}</b></p>
          {pay.currency !== "USD" ? <p className="when">{`Worked out in ${pay.currency}, using the ${country} figures from the Earnings Estimator.`}</p> : null}
        </div>
        <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
        <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn primary" type="button" disabled={pending || !inputs} onClick={submit}>{pending ? "Saving…" : "Save"}</button></div>
      </div>
    </dialog>
  );
}
