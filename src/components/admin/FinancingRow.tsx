"use client";

import { useState, useTransition } from "react";
import { removeFinancing, reviewFinancing } from "@/app/(app)/admin/financing/actions";
import type { FinancingOption } from "@/lib/financing/queries";
import { formatInZone } from "@/lib/time";

export function FinancingRow({ o, who }: { o: FinancingOption; who: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setError(""); const r = await fn(); if (!r.ok) setError(r.error ?? "That did not work."); });
  return (
    <article className="post card-s" style={{ marginBottom: 14 }}>
      <header className="post-head"><strong>{o.title}</strong><span className="when">{who} · {formatInZone(new Date(o.created_at))}</span></header>
      <p className="post-body">{o.description}</p>
      {o.link ? <p style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}><a href={o.link} target="_blank" rel="noopener noreferrer nofollow">{o.link}</a></p> : null}
      {o.status === "pending" ? (
        <div className="rs-actions">
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note to the member" aria-label="Optional note" />
          <button className="btn primary small" type="button" disabled={pending} onClick={() => run(() => reviewFinancing(o.id, "approved", note))}>Approve</button>
          <button className="btn small" type="button" disabled={pending} onClick={() => run(() => reviewFinancing(o.id, "declined", note))}>Decline</button>
        </div>
      ) : (
        <div className="rs-actions">
          <span className="when">{o.status === "approved" ? "Live for everyone" : "Declined"}{o.review_note ? `: ${o.review_note}` : ""}</span>
          <button className="linkbtn danger" type="button" disabled={pending} onClick={() => { if (window.confirm("Remove this option?")) run(() => removeFinancing(o.id)); }}>Remove</button>
        </div>
      )}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </article>
  );
}
