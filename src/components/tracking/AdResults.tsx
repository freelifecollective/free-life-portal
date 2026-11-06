"use client";

import { useState, useTransition } from "react";
import { addAdResult, deleteAdResult, type AdRow } from "@/app/(app)/tracking/numbers/actions";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdResults({ rows }: { rows: AdRow[] }) {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [campaign, setCampaign] = useState("");
  const [spend, setSpend] = useState("");
  const [leads, setLeads] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const spent = rows.reduce((n, r) => n + r.spend, 0);
  const got = rows.reduce((n, r) => n + r.leads, 0);
  const tiles: [string, string][] = [["Ad spend", money(spent)], ["Leads from ads", String(got)], ["Cost per lead", got ? money(spent / got) : "—"]];

  function add() {
    setError("");
    start(async () => {
      const r = await addAdResult({ day, campaign, spend: Number(spend || 0), leads: Number(leads || 0) });
      if (r.ok) { setCampaign(""); setSpend(""); setLeads(""); } else setError(r.error);
    });
  }

  return (
    <section style={{ marginTop: 26 }} aria-labelledby="ad-h">
      <h2 id="ad-h" className="qh">Ad results</h2>
      <p className="when" style={{ margin: "0 0 12px" }}>Add what you spent on ads and how many leads they brought in. Once your Meta account is connected, this will fill in by itself.</p>
      <div className="kn-tiles">{tiles.map(([label, v]) => <div key={label} className="card-s kn-tile"><b>{v}</b><span>{label}</span></div>)}</div>
      <div className="card-s" style={{ marginTop: 14, maxWidth: 980 }}>
        <div className="lb-grid2">
          <div className="field"><label htmlFor="ad-day">Date</label><input id="ad-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>
          <div className="field"><label htmlFor="ad-camp">Ad or campaign (optional)</label><input id="ad-camp" type="text" maxLength={80} value={campaign} onChange={(e) => setCampaign(e.target.value)} /></div>
          <div className="field"><label htmlFor="ad-spend">Spent ($)</label><input id="ad-spend" type="number" min={0} step="0.01" inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} /></div>
          <div className="field"><label htmlFor="ad-leads">Leads</label><input id="ad-leads" type="number" min={0} step={1} inputMode="numeric" value={leads} onChange={(e) => setLeads(e.target.value)} /></div>
        </div>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <button type="button" className="btn primary" disabled={pending} onClick={add}>{pending ? "Saving…" : "Add ad results"}</button>
      </div>
      {rows.length ? (
        <div className="table-wrap" style={{ marginTop: 14 }}><table className="admin-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Ad</th><th scope="col">Spent</th><th scope="col">Leads</th><th scope="col">Cost per lead</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td>{r.day}</td><td>{r.campaign ?? "—"}</td><td>{money(r.spend)}</td><td>{r.leads}</td><td>{r.leads ? money(r.spend / r.leads) : "—"}</td>
              <td><button type="button" className="btn small" disabled={pending} aria-label={`Remove the ${r.day} ad result`} onClick={() => { if (window.confirm("Remove this entry?")) start(async () => { const x = await deleteAdResult(r.id); if (!x.ok) setError(x.error); }); }}>Remove</button></td></tr>
          ))}</tbody>
        </table></div>
      ) : null}
    </section>
  );
}
