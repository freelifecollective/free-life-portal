"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockDates, disconnectGoogle, unblockDate } from "@/app/(app)/settings/availability/actions";

export type Blocked = { day: string; note: string | null };
const pretty = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${d}T00:00:00Z`));

/** Dates you are away: leads cannot book on them. */
export function BlockedDates({ blocked, today }: { blocked: Blocked[]; today: string }) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="av-card av-blocked">
      <div className="av-head"><div><h2 className="qh">Blocked dates</h2><p className="when">Days you are away. Leads cannot book these.</p></div></div>
      <form className="av-block-form" onSubmit={(e) => { e.preventDefault(); start(async () => { setError(""); const r = await blockDates(from, to, note); if (!r.ok) { setError(r.error ?? "That did not work."); return; } setFrom(""); setTo(""); setNote(""); router.refresh(); }); }}>
        <label>From<input type="date" required min={today} value={from} onChange={(e) => { setFrom(e.target.value); if (to && to < e.target.value) setTo(""); }} /></label>
        <label>To (optional)<input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="av-block-note">Note (optional)<input type="text" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Holiday" /></label>
        <button className="btn small primary" type="submit" disabled={pending || !from}>Block</button>
      </form>
      {error ? <p className="err" role="alert" style={{ minHeight: 0, margin: "6px 0 0" }}>{error}</p> : null}
      {blocked.length ? (
        <ul className="av-blocked-list">
          {blocked.map((b) => (
            <li key={b.day}><span>{pretty(b.day)}{b.note ? <small className="when" translate="no"> · {b.note}</small> : null}</span><button type="button" className="av-copy" disabled={pending} onClick={() => start(async () => { await unblockDate(b.day); router.refresh(); })}>Remove</button></li>
          ))}
        </ul>
      ) : <p className="when" style={{ margin: "8px 0 0" }}>No blocked dates.</p>}
    </section>
  );
}

/** Link your Google Calendar so anything already in it (personal items too) is taken off the times leads can pick. */
export function GoogleCalendarCard({ configured, email, status }: { configured: boolean; email: string | null; status: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="av-card av-google">
      <div className="av-head"><div><h2 className="qh">Google Calendar</h2><p className="when">Anything already in your calendar, personal items too, is taken off the times leads can book. Only when you are busy is read, never what the event is.</p></div></div>
      {status === "connected" ? <p className="when" style={{ margin: "0 0 8px", color: "var(--ok)" }}>Connected.</p> : null}
      {status === "failed" ? <p className="err" role="alert" style={{ minHeight: 0, margin: "0 0 8px" }}>We could not connect your Google Calendar. Please try again.</p> : null}
      {email ? (
        <div className="av-google-row"><span>Connected as <b translate="no">{email}</b></span>
          <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { await disconnectGoogle(); router.refresh(); })}>Disconnect</button></div>
      ) : configured ? (
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a className="btn small primary" href="/api/google/connect?from=/call-closer" style={{ textDecoration: "none" }}>Connect Google Calendar</a>
      ) : <p className="when" style={{ margin: 0 }}>Google Calendar is not switched on for the portal yet. It needs a one-time setup by the portal admin.</p>}
    </section>
  );
}
