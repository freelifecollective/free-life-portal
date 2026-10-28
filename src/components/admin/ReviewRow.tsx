"use client";

import { useState, useTransition } from "react";
import { reviewSubmission } from "@/app/(app)/admin/resources/actions";
import type { Submission } from "@/lib/resources/queries";
import { formatInZone } from "@/lib/time";

export function ReviewRow({ sub, author, urls }: { sub: Submission; author: string; urls: { name: string; url: string | null }[] }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const decide = (d: "accepted" | "declined") => start(async () => {
    setError("");
    const r = await reviewSubmission(sub.id, d, note);
    if (!r.ok) setError(r.error ?? "That did not work.");
  });
  return (
    <article className="post card-s" style={{ marginBottom: 14 }}>
      <header className="post-head"><strong>{sub.title}</strong><span className="when">{author} · {formatInZone(new Date(sub.created_at))}</span></header>
      <p className="post-body">{sub.description}</p>
      {sub.links.length || urls.length ? (
        <ul className="rs-items">
          {sub.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow">{l}</a></li>)}
          {urls.map((u) => <li key={u.name}>{u.url ? <a href={u.url} target="_blank" rel="noopener noreferrer">{u.name}</a> : `${u.name} (unavailable)`}</li>)}
        </ul>
      ) : null}
      {sub.status === "pending" ? (
        <div className="rs-actions">
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note to the member" aria-label="Optional note" />
          <button className="btn primary small" type="button" disabled={pending} onClick={() => decide("accepted")}>Accept</button>
          <button className="btn small" type="button" disabled={pending} onClick={() => decide("declined")}>Decline</button>
        </div>
      ) : <p className="when">{sub.status === "accepted" ? "Accepted" : "Declined"}{sub.review_note ? `: ${sub.review_note}` : ""}</p>}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </article>
  );
}
