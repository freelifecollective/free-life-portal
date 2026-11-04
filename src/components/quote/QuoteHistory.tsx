"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQuote, setQuoteFollowedUp } from "@/app/(app)/calculator/actions";
import { nowMs } from "@/lib/time";

export type PastQuote = { token: string; lead: string; title: string; total: string; sentAt: string; email: string | null; done: boolean };

const ago = (iso: string) => {
  const days = Math.floor((nowMs() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};
const dayText = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/** The quotes already made and sent. Open one, copy its link, mark it followed up, or remove it. */
export function QuoteHistory({ quotes, startOpen }: { quotes: PastQuote[]; startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!startOpen);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const due = quotes.filter((q) => !q.done && (nowMs() - new Date(q.sentAt).getTime()) / 86_400_000 >= 3).length;

  async function copy(token: string) {
    const url = `${location.origin}/q/${token}`;
    try { await navigator.clipboard.writeText(url); setMsg("Link copied ✓"); } catch { setMsg(url); }
  }
  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <section className="qh-wrap" aria-label="Quotes already sent">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        Quotes I&apos;ve sent ({quotes.length}){due ? <span className="badge" style={{ marginLeft: 8 }} aria-label={`${due} to follow up`}>{due}</span> : null}
      </button>
      {open ? (
        <div className="qh-list">
          {quotes.length === 0 ? <p className="when" style={{ margin: 0 }}>You haven&apos;t sent any quotes yet. Make one below.</p> : (
            <ul className="admin-list">
              {quotes.map((q) => {
                const needs = !q.done && (nowMs() - new Date(q.sentAt).getTime()) / 86_400_000 >= 3;
                return (
                  <li key={q.token} style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong translate="no">{q.lead || "No name"}</strong> <span className="muted-line" translate="no">· {q.title} · {q.total}</span>
                      <div className="muted-line">{q.email ? `Emailed to ${q.email}` : "Link shared"} · {dayText(q.sentAt)} ({ago(q.sentAt)})
                        {q.done ? " · Followed up ✓" : needs ? " · Time to follow up" : ""}</div>
                    </div>
                    <span style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <a className="linkbtn" href={`/q/${q.token}`} target="_blank" rel="noopener noreferrer">View</a>
                      <button type="button" className="linkbtn" onClick={() => copy(q.token)}>Copy link</button>
                      <button type="button" className="linkbtn" disabled={pending} onClick={() => act(() => setQuoteFollowedUp(q.token, !q.done))}>{q.done ? "Open again" : "Followed up"}</button>
                      <button type="button" className="linkbtn" disabled={pending} onClick={() => act(() => deleteQuote(q.token))}>Remove</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="when" role="status" style={{ margin: "8px 0 0" }}>{msg}</p>
        </div>
      ) : null}
    </section>
  );
}
